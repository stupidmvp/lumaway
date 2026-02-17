'use client';

import { useState, use } from 'react';
import {
    useProjectMembers,
    useRemoveMember,
    useUpdateMemberRole,
    useCurrentUser,
    useProject,
    usePermissions,
    useProjectSettingsPermissions,
    ProjectMember,
} from '@luma/infra';
import { useDebounce } from 'use-debounce';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
    Trash2,
    Users,
    Search,
} from 'lucide-react';
import { MainContent } from '@/components/shared/MainContent';
import { StandardToolbar } from '@/components/shared/StandardToolbar';
import { StandardPagination } from '@/components/shared/StandardPagination';
import { UserAvatar } from '@/components/ui/user-avatar';
import { InviteMemberDialog } from '@/components/project-detail/InviteMemberDialog';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

const ROLE_ICONS: Record<string, React.ElementType> = { editor: Pencil, viewer: Eye };
const ROLE_COLORS: Record<string, string> = { editor: 'text-accent-blue', viewer: 'text-foreground-muted' };
const ROLE_BG: Record<string, string> = { editor: 'bg-accent-blue/10', viewer: 'bg-foreground-muted/10' };

export default function MembersPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: projectId } = use(params);
    const t = useTranslations('Members');
    const tc = useTranslations('Common');

    // Search, filter & pagination (server-side)
    const [memberSearch, setMemberSearch] = useState('');
    const [debouncedSearch] = useDebounce(memberSearch, 300);
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [page, setPage] = useState(0);
    const limit = 20;

    // Dialogs
    const [inviteOpen, setInviteOpen] = useState(false);
    const [memberToRemove, setMemberToRemove] = useState<ProjectMember | null>(null);

    const { data: currentUser } = useCurrentUser();
    const { data: project } = useProject(projectId);
    const { data: membersData, isLoading: membersLoading, isFetching: membersFetching } = useProjectMembers(
        projectId, debouncedSearch, limit, page * limit, { role: roleFilter }
    );

    const removeMember = useRemoveMember();
    const updateRole = useUpdateMemberRole();

    const members: ProjectMember[] = membersData?.data || [];
    const totalMembers = membersData?.total || 0;
    const totalPages = Math.ceil(totalMembers / limit);

    const permissions = usePermissions();
    const ctx = { projectId, organizationId: project?.organizationId };
    const isOwner = permissions.can('manage', 'project_members', ctx);
    const { canInviteMembers } = useProjectSettingsPermissions(projectId);
    const canInvite = isOwner || canInviteMembers;

    const handleRemoveMember = async () => {
        if (!memberToRemove) return;
        try {
            await removeMember.mutateAsync({ id: memberToRemove.id, projectId });
            toast.success(t('memberRemoved'));
        } catch {
            toast.error(t('removeFailed'));
        } finally {
            setMemberToRemove(null);
        }
    };

    const handleRoleChange = async (memberId: string, newRole: string) => {
        try {
            await updateRole.mutateAsync({ id: memberId, role: newRole, projectId });
            toast.success(t('roleUpdated'));
        } catch {
            toast.error(t('roleUpdateFailed'));
        }
    };

    return (
        <MainContent>
            <StandardToolbar
                search={memberSearch}
                onSearchChange={(val) => { setMemberSearch(val); setPage(0); }}
                onSearchClear={() => { setMemberSearch(''); setPage(0); }}
                filterValue={roleFilter}
                onFilterChange={(val) => { setRoleFilter(val); setPage(0); }}
                filterOptions={[
                    { label: t('roleEditor'), value: 'editor', icon: Pencil },
                    { label: t('roleViewer'), value: 'viewer', icon: Eye },
                ]}
                filterTitle={t('filterRole')}
                placeholder={t('searchMembers')}
                actions={canInvite ? (
                    <Button
                        onClick={() => setInviteOpen(true)}
                        size="sm"
                        className="h-8 gap-1.5 bg-accent-blue hover:bg-accent-blue/90 text-white shadow-sm cursor-pointer"
                    >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">{t('inviteMember')}</span>
                    </Button>
                ) : undefined}
            />

            {/* Members list */}
            <div className="relative">
                {membersFetching && !membersLoading && (
                    <div className="absolute inset-0 bg-background/50 z-10 flex items-center justify-center rounded-xl pointer-events-none">
                        <Loader2 className="h-5 w-5 animate-spin text-foreground-muted" />
                    </div>
                )}

                {membersLoading ? (
                    <div className="space-y-2">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex items-center gap-4 px-5 py-3.5 rounded-xl border border-border/40 bg-background-secondary/20 animate-pulse">
                                <div className="h-8 w-8 rounded-full bg-foreground-muted/10" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-3.5 w-32 rounded bg-foreground-muted/10" />
                                    <div className="h-3 w-48 rounded bg-foreground-muted/10" />
                                </div>
                                <div className="h-6 w-20 rounded bg-foreground-muted/10" />
                            </div>
                        ))}
                    </div>
                ) : totalMembers === 0 && !debouncedSearch && roleFilter === 'all' ? (
                    <div className="bg-background rounded-xl border border-dashed border-border">
                        <div className="flex flex-col items-center justify-center py-16 px-6">
                            <div className="h-12 w-12 rounded-full bg-accent-blue/10 flex items-center justify-center mb-4">
                                <Users className="h-6 w-6 text-accent-blue" />
                            </div>
                            <h3 className="text-sm font-semibold text-foreground mb-1">{t('noMembers')}</h3>
                            <p className="text-xs text-foreground-muted text-center max-w-sm mb-5">{t('noMembersDescription')}</p>
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
                ) : members.length === 0 ? (
                    <div className="bg-background rounded-xl border border-dashed border-border">
                        <div className="flex flex-col items-center justify-center py-12 px-6">
                            <Search className="h-8 w-8 text-foreground-muted/30 mb-3" />
                            <p className="text-sm text-foreground-muted">{t('noSearchResults')}</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-background rounded-xl border border-border divide-y divide-border">
                        {members.map((member) => {
                            const RoleIcon = ROLE_ICONS[member.role] || Eye;
                            const isCurrentUser = member.userId === currentUser?.id;
                            const memberName = [member.user?.firstName, member.user?.lastName].filter(Boolean).join(' ') || member.user?.email || '—';

                            return (
                                <div key={member.id} className="flex items-center gap-4 px-5 py-3.5 group hover:bg-background-secondary/30 transition-colors">
                                    <UserAvatar
                                        firstName={member.user?.firstName}
                                        lastName={member.user?.lastName}
                                        avatar={member.user?.avatar}
                                        size="sm"
                                        userInfo={{ email: member.user?.email, role: member.role }}
                                        triggerMode="hover"
                                    />

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-sm font-medium text-foreground truncate">{memberName}</span>
                                            {isCurrentUser && (
                                                <span className="text-[10px] text-foreground-muted font-medium">({t('you')})</span>
                                            )}
                                        </div>
                                        <span className="text-xs text-foreground-muted truncate block">{member.user?.email}</span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {isOwner && !isCurrentUser ? (
                                            <Select value={member.role} onValueChange={(newRole) => handleRoleChange(member.id, newRole)}>
                                                <SelectTrigger className="h-7 w-auto min-w-[110px] text-xs border-none bg-background-secondary/50 hover:bg-background-secondary">
                                                    <div className="flex items-center gap-1.5">
                                                        <RoleIcon className={`h-3 w-3 ${ROLE_COLORS[member.role]}`} />
                                                        <span>{t(member.role as 'owner' | 'editor' | 'viewer')}</span>
                                                    </div>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="editor">
                                                        <div className="flex items-center gap-2">
                                                            <Pencil className="h-3 w-3 text-accent-blue" />
                                                            <span>{t('roleEditor')}</span>
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value="viewer">
                                                        <div className="flex items-center gap-2">
                                                            <Eye className="h-3 w-3 text-foreground-muted" />
                                                            <span>{t('roleViewer')}</span>
                                                        </div>
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs ${ROLE_BG[member.role]}`}>
                                                <RoleIcon className={`h-3 w-3 ${ROLE_COLORS[member.role]}`} />
                                                <span className={ROLE_COLORS[member.role]}>{t(member.role as 'owner' | 'editor' | 'viewer')}</span>
                                            </div>
                                        )}

                                        {isOwner && !isCurrentUser && (
                                            <button
                                                onClick={() => setMemberToRemove(member)}
                                                className="p-1.5 rounded-md text-foreground-muted hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                                title={t('removeMember')}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <StandardPagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalResults={totalMembers}
                limit={limit}
                resultsOnPage={members.length}
            />

            {/* Invite Dialog */}
            <InviteMemberDialog projectId={projectId} open={inviteOpen} onOpenChange={setInviteOpen} />

            {/* Remove Member Confirmation */}
            <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('removeMemberTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('removeMemberDescription', {
                                name: [memberToRemove?.user?.firstName, memberToRemove?.user?.lastName].filter(Boolean).join(' ') || memberToRemove?.user?.email || '',
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemoveMember} className="bg-red-500 hover:bg-red-600 text-white">
                            {removeMember.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {t('removeMember')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </MainContent>
    );
}
