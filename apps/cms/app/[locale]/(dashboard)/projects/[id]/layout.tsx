'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Loader2,
    GitPullRequest,
    MessageCircle,
    Users,
    Mail,
    Settings,
    Plus,
    Archive,
    UserCog,
} from 'lucide-react';
import {
    useProject,
    useProjectComments,
    useProjectMembers,
    useProjectInvitations,
    usePermissions,
    type ProjectInvitation,
} from '@luma/infra';
import { CreateWalkthroughDialog } from '@/components/project-detail/CreateWalkthroughDialog';
import { ProjectTitle } from '@/components/project-detail/ProjectTitle';
import { ProjectActionsMenu } from '@/components/shared/ProjectActionsMenu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

type TabKey = 'walkthroughs' | 'activity' | 'members' | 'invitations' | 'actors' | 'settings';

interface TabDef {
    key: TabKey;
    href: string;
    icon: React.ElementType;
    label: string;
    badge?: number;
    badgeColor?: 'blue' | 'amber' | 'muted';
    hidden?: boolean;
}

export default function ProjectLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();

    const [createOpen, setCreateOpen] = useState(false);

    const t = useTranslations('ProjectDetail');
    const tc = useTranslations('Common');
    const tComments = useTranslations('Comments');
    const tMembers = useTranslations('Members');
    const tSettings = useTranslations('ProjectSettings');
    const tActors = useTranslations('Actors');

    // ── Data fetching for badges ──────────────────────────────────────
    const { data: project, isLoading: projectLoading } = useProject(id);
    const { data: commentsData } = useProjectComments(id, { limit: 0 });
    const commentsCount = commentsData?.total || 0;

    const { data: membersData } = useProjectMembers(id, undefined, 0, 0, { includeOwner: true });
    const membersCount = membersData?.total || 0;

    const { data: invitationsData } = useProjectInvitations(id);
    const pendingInvitations = useMemo(
        () => ((invitationsData?.data || []) as ProjectInvitation[]).filter((inv) => inv.status === 'pending'),
        [invitationsData],
    );

    const permissions = usePermissions();
    const ctx = { projectId: id, organizationId: project?.organizationId };
    const canCreateWalkthroughs = permissions.can('create', 'walkthroughs', ctx);
    const canManageProject = permissions.can('update', 'projects', ctx);

    // ── Active tab from pathname ──────────────────────────────────────
    const activeTab: TabKey = useMemo(() => {
        if (pathname.endsWith('/activity')) return 'activity';
        if (pathname.endsWith('/members')) return 'members';
        if (pathname.endsWith('/invitations')) return 'invitations';
        if (pathname.endsWith('/actors')) return 'actors';
        if (pathname.endsWith('/settings')) return 'settings';
        return 'walkthroughs';
    }, [pathname]);

    // ── Backward compat: redirect ?tab= to proper routes ─────────────
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (!tab) return;

        const commentId = searchParams.get('commentId');
        const qs = commentId ? `?commentId=${commentId}` : '';

        if (tab === 'activity' || tab === 'discussion') {
            router.replace(`/projects/${id}/activity${qs}`);
        } else if (tab === 'members') {
            router.replace(`/projects/${id}/members`);
        } else if (tab === 'settings') {
            router.replace(`/projects/${id}/settings`);
        }
    }, [searchParams, id, router]);

    // ── Tab definitions ───────────────────────────────────────────────
    const tabs: TabDef[] = useMemo(() => [
        {
            key: 'walkthroughs',
            href: `/projects/${id}`,
            icon: GitPullRequest,
            label: t('walkthroughs'),
        },
        {
            key: 'activity',
            href: `/projects/${id}/activity`,
            icon: MessageCircle,
            label: tComments('title'),
            badge: commentsCount,
            badgeColor: 'blue',
        },
        {
            key: 'members',
            href: `/projects/${id}/members`,
            icon: Users,
            label: tMembers('tabMembers'),
            badge: membersCount,
            badgeColor: 'muted',
        },
        {
            key: 'invitations',
            href: `/projects/${id}/invitations`,
            icon: Mail,
            label: tMembers('tabInvitations'),
            badge: pendingInvitations.length,
            badgeColor: 'amber',
        },
        {
            key: 'actors',
            href: `/projects/${id}/actors`,
            icon: UserCog,
            label: tActors('title'),
            hidden: !canManageProject,
        },
        {
            key: 'settings',
            href: `/projects/${id}/settings`,
            icon: Settings,
            label: tSettings('title'),
            hidden: !canManageProject,
        },
    ], [id, t, tComments, tMembers, tSettings, tActors, commentsCount, membersCount, pendingInvitations.length, canManageProject]);

    // ── Render ────────────────────────────────────────────────────────

    if (projectLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
            </div>
        );
    }

    if (!project) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-foreground-muted text-sm">{t('projectNotFound')}</p>
            </div>
        );
    }

    const badgeColorMap = {
        blue: 'bg-accent-blue/10 text-accent-blue',
        amber: 'bg-amber-500/10 text-amber-500',
        muted: 'bg-foreground-muted/10 text-foreground-muted',
    };

    return (
        <div className="flex flex-col h-full bg-background transition-colors duration-300">
            <CreateWalkthroughDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                projectId={id}
            />

            {/* Headline section: title + actions + tabs */}
            <div className="px-5 sm:px-6 pt-5 bg-background-secondary dark:bg-background shrink-0">
                <div className="max-w-6xl mx-auto">
                    {/* Title row with actions */}
                    <div className="flex items-start justify-between gap-4">
                        <ProjectTitle
                            projectId={id}
                            organizationId={project.organizationId}
                            initialTitle={project.name}
                            logo={project.logo}
                            status={project.status}
                            owner={project.owner}
                            createdAt={project.createdAt}
                            members={project.members}
                            membersCount={project.membersCount}
                        />

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0 pt-1">
                            {project.status === 'archived' && (
                                <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 gap-1 px-1.5 py-0.5 h-5 shrink-0">
                                    <Archive className="h-2.5 w-2.5" />
                                    <span className="text-[9px] font-bold uppercase tracking-wider">{tc('archived')}</span>
                                </Badge>
                            )}

                            {canCreateWalkthroughs && (
                                <Button
                                    onClick={() => setCreateOpen(true)}
                                    disabled={project.status === 'archived'}
                                    size="sm"
                                    className={cn(
                                        "h-8 gap-1.5 text-white shadow-sm cursor-pointer px-2 sm:px-3",
                                        project.status === 'archived'
                                            ? "bg-foreground-muted/20 opacity-50 cursor-not-allowed"
                                            : "bg-accent-blue hover:bg-accent-blue/90"
                                    )}
                                    title={project.status === 'archived' ? t('cannotCreateArchived') : undefined}
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    <span className="text-xs font-medium hidden sm:inline">{t('newWalkthrough')}</span>
                                </Button>
                            )}

                            {canManageProject && (
                                <ProjectActionsMenu
                                    project={{ id, name: project.name, status: project.status }}
                                    onDeleteSuccess={() => router.push('/projects')}
                                    triggerClassName="h-8 w-8 hover:bg-background-secondary rounded-md flex items-center justify-center cursor-pointer"
                                />
                            )}
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-1 border-b border-border mt-3">
                        {tabs
                            .filter((tab) => !tab.hidden)
                            .map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.key;

                                return (
                                    <Link
                                        key={tab.key}
                                        href={tab.href}
                                        className={cn(
                                            'relative px-4 py-2.5 text-sm font-medium transition-colors',
                                            isActive
                                                ? 'text-foreground'
                                                : 'text-foreground-muted hover:text-foreground',
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Icon className="h-4 w-4" />
                                            {tab.label}
                                            {!!tab.badge && tab.badge > 0 && (
                                                <span
                                                    className={cn(
                                                        'h-5 min-w-[20px] px-1.5 text-[10px] font-bold rounded-full flex items-center justify-center',
                                                        badgeColorMap[tab.badgeColor || 'muted'],
                                                    )}
                                                >
                                                    {tab.badge}
                                                </span>
                                            )}
                                        </div>
                                        {isActive && (
                                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue rounded-t" />
                                        )}
                                    </Link>
                                );
                            })}
                    </div>
                </div>
            </div>

            {/* Tab content — fills remaining space */}
            {children}
        </div>
    );
}
