'use client';

import { useState, use, useMemo } from 'react';
import {
    useProjectInvitations,
    useRevokeInvitation,
    useProject,
    usePermissions,
    useProjectSettingsPermissions,
    type ProjectInvitation,
} from '@luma/infra';
import { Button } from '@/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Loader2,
    UserPlus,
    Pencil,
    Eye,
    Mail,
    Clock,
} from 'lucide-react';
import { MainContent } from '@/components/shared/MainContent';
import { InviteMemberDialog } from '@/components/project-detail/InviteMemberDialog';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

const ROLE_ICONS: Record<string, React.ElementType> = { editor: Pencil, viewer: Eye };
const ROLE_COLORS: Record<string, string> = { editor: 'text-accent-blue', viewer: 'text-foreground-muted' };

export default function InvitationsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: projectId } = use(params);
    const t = useTranslations('Members');
    const tc = useTranslations('Common');

    const [inviteOpen, setInviteOpen] = useState(false);
    const [invitationToRevoke, setInvitationToRevoke] = useState<ProjectInvitation | null>(null);

    const { data: project } = useProject(projectId);
    const { data: invitationsData, isLoading } = useProjectInvitations(projectId);

    const revokeInvitation = useRevokeInvitation();

    const pendingInvitations: ProjectInvitation[] = useMemo(
        () => ((invitationsData?.data || []) as ProjectInvitation[]).filter((inv) => inv.status === 'pending'),
        [invitationsData],
    );

    const permissions = usePermissions();
    const ctx = { projectId, organizationId: project?.organizationId };
    const isOwner = permissions.can('manage', 'project_members', ctx);
    const { canInviteMembers } = useProjectSettingsPermissions(projectId);
    const canInvite = isOwner || canInviteMembers;

    const handleRevoke = async () => {
        if (!invitationToRevoke) return;
        try {
            await revokeInvitation.mutateAsync({ id: invitationToRevoke.id, projectId });
            toast.success(t('invitationRevoked'));
        } catch {
            toast.error(t('revokeFailed'));
        } finally {
            setInvitationToRevoke(null);
        }
    };

    return (
        <MainContent>
            {/* Toolbar row — consistent with other tabs */}
            {canInvite && (
                <div className="flex items-center justify-end mb-6">
                    <Button
                        onClick={() => setInviteOpen(true)}
                        size="sm"
                        className="h-8 gap-1.5 bg-accent-blue hover:bg-accent-blue/90 text-white shadow-sm cursor-pointer"
                    >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">{t('inviteMember')}</span>
                    </Button>
                </div>
            )}

            {/* Content */}
            {isLoading ? (
                <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center gap-4 px-5 py-3.5 rounded-xl border border-border/40 bg-background-secondary/20 animate-pulse">
                            <div className="h-8 w-8 rounded-full bg-foreground-muted/10" />
                            <div className="flex-1 space-y-2">
                                <div className="h-3.5 w-40 rounded bg-foreground-muted/10" />
                                <div className="h-3 w-28 rounded bg-foreground-muted/10" />
                            </div>
                            <div className="h-6 w-16 rounded bg-foreground-muted/10" />
                        </div>
                    ))}
                </div>
            ) : pendingInvitations.length === 0 ? (
                <div className="bg-background rounded-xl border border-dashed border-border">
                    <div className="flex flex-col items-center justify-center py-16 px-6">
                        <div className="h-12 w-12 rounded-full bg-foreground-muted/5 flex items-center justify-center mb-4">
                            <Mail className="h-6 w-6 text-foreground-muted/40" />
                        </div>
                        <h3 className="text-sm font-semibold text-foreground mb-1">{t('noPendingInvitations')}</h3>
                        <p className="text-xs text-foreground-muted text-center max-w-sm mb-5">
                            {t('noPendingInvitationsDescription')}
                        </p>
                        {canInvite && (
                            <Button
                                onClick={() => setInviteOpen(true)}
                                className="gap-2 bg-accent-blue hover:bg-accent-blue/90 text-white cursor-pointer"
                            >
                                <UserPlus className="h-4 w-4" />
                                {t('inviteMember')}
                            </Button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-background rounded-xl border border-border divide-y divide-border">
                    {pendingInvitations.map((invitation) => {
                        const RoleIcon = ROLE_ICONS[invitation.role] || Eye;

                        return (
                            <div
                                key={invitation.id}
                                className="flex items-center gap-4 px-5 py-3.5 group hover:bg-background-secondary/30 transition-colors"
                            >
                                <div className="h-8 w-8 rounded-full bg-background-secondary border border-dashed border-border flex items-center justify-center shrink-0">
                                    <Mail className="h-3.5 w-3.5 text-foreground-muted" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium text-foreground truncate block">
                                        {invitation.email}
                                    </span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <Clock className="h-3 w-3 text-foreground-muted" />
                                        <span className="text-[11px] text-foreground-muted">{t('invited')}</span>
                                        <span className="h-0.5 w-0.5 rounded-full bg-foreground-muted/40" />
                                        <RoleIcon className={`h-3 w-3 ${ROLE_COLORS[invitation.role]}`} />
                                        <span className={`text-[11px] ${ROLE_COLORS[invitation.role]}`}>
                                            {t(invitation.role as 'owner' | 'editor' | 'viewer')}
                                        </span>
                                    </div>
                                </div>

                                {isOwner && (
                                    <button
                                        onClick={() => setInvitationToRevoke(invitation)}
                                        disabled={revokeInvitation.isPending}
                                        className="px-2.5 py-1 rounded-md text-xs font-medium text-foreground-muted hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                    >
                                        {t('revokeInvitation')}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Invite Dialog */}
            <InviteMemberDialog projectId={projectId} open={inviteOpen} onOpenChange={setInviteOpen} />

            {/* Revoke Invitation Confirmation */}
            <AlertDialog open={!!invitationToRevoke} onOpenChange={(open) => !open && setInvitationToRevoke(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('revokeInvitationTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('revokeInvitationDescription', { email: invitationToRevoke?.email || '' })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRevoke} className="bg-red-500 hover:bg-red-600 text-white">
                            {revokeInvitation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {t('revokeInvitation')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </MainContent>
    );
}
