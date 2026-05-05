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
    Clapperboard,
    Settings2,
    Layers,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { ENV } from '@/lib/env';
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

type TabKey = 'walkthroughs' | 'lumens' | 'activity' | 'members' | 'invitations' | 'actors' | 'settings';

interface TabDef {
    key: TabKey | string;
    href: string;
    icon: React.ElementType;
    label: string;
    badge?: number;
    badgeColor?: 'blue' | 'amber' | 'muted';
    hidden?: boolean;
    isContextual?: boolean;
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
        if (pathname.includes('/lumens/')) return 'lumens'; // Treat specific lumen as lumens tab active
        if (pathname.includes('/lumens')) return 'lumens';
        if (pathname.endsWith('/members')) return 'members';
        if (pathname.endsWith('/invitations')) return 'invitations';
        if (pathname.endsWith('/actors')) return 'actors';
        if (pathname.endsWith('/settings')) return 'settings';
        return 'walkthroughs';
    }, [pathname]);

    // Check if we are inside a specific lumen
    const lumenMatch = pathname.match(/\/lumens\/([^\/]+)/);
    const activeLumenId = lumenMatch ? lumenMatch[1] : null;

    // ── Backward compat: redirect ?tab= to proper routes ─────────────
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (!tab) return;

        const commentId = searchParams.get('commentId');
        const qs = commentId ? `?commentId=${commentId}` : '';

        if (tab === 'activity' || tab === 'discussion') {
            router.replace(`/projects/${id}/activity${qs}`);
        } else if (tab === 'lumens') {
            router.replace(`/projects/${id}/lumens`);
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
            key: 'lumens',
            href: `/projects/${id}/lumens`,
            icon: Clapperboard,
            label: t('lumens'),
            hidden: !canManageProject,
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

    // ── Dynamic items for Sub-sidebar ────────────────────────────────
    const rawNavigationItems = useMemo(() => {
        const baseItems = tabs.filter(tab => !tab.hidden);
        
        if (activeLumenId) {
            // Find index of lumens to insert after or just push to end of navigation group
            return [
                ...baseItems,
                {
                    key: 'properties' as any,
                    href: '#', // Placeholder or state-based
                    icon: Settings2,
                    label: t('properties') || 'Properties',
                    isContextual: true
                },
                {
                    key: 'process' as any,
                    href: '#', // Placeholder or state-based
                    icon: Layers,
                    label: t('process') || 'Process',
                    isContextual: true
                }
            ];
        }
        
        return baseItems;
    }, [tabs, activeLumenId, t]);

    // Update base items labels to match translation keys if they don't exist in ProjectDetail
    const navigationItems = useMemo(() => {
        return rawNavigationItems.map(item => ({
            ...item,
            label: t(item.key as any) || item.label
        }));
    }, [rawNavigationItems, t]);

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
        <TooltipProvider>
            <div className="flex h-full bg-background overflow-hidden">
                <CreateWalkthroughDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    projectId={id}
                />

                {/* Sub-Sidebar: Navigation & Contextual Options */}
                <aside 
                    className="border-r border-border bg-background-secondary/30 flex flex-col shrink-0 overflow-hidden w-16"
                >
                    {/* Simplified Sidebar Header */}
                    <div className="h-14 flex items-center justify-center border-b border-border/40 shrink-0">
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center border border-border/20 shrink-0 transition-all overflow-hidden bg-white shadow-sm dark:bg-background-secondary">
                            {project.logo ? (
                                <img 
                                    src={project.logo.startsWith('http') ? project.logo : `${ENV.S3_URL_BASE}${project.logo}`} 
                                    alt={project.name} 
                                    className="h-full w-full object-contain p-1"
                                />
                            ) : (
                                <div className="h-full w-full bg-accent-blue/10 text-accent-blue flex items-center justify-center">
                                    <Clapperboard className="h-5 w-5" />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-2">
                        {navigationItems.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.key;

                            return (
                                <Tooltip key={tab.key} delayDuration={0}>
                                    <TooltipTrigger asChild>
                                        <Link
                                            href={tab.href}
                                            className={cn(
                                                'group flex items-center justify-center px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 relative',
                                                isActive
                                                    ? 'bg-background-secondary text-foreground shadow-sm'
                                                    : 'text-foreground-muted hover:text-foreground hover:bg-background-secondary/50'
                                            )}
                                        >
                                            <div className="flex items-center justify-center min-w-0">
                                                <Icon className={cn(
                                                    "h-5 w-5 transition-colors shrink-0",
                                                    isActive ? "text-accent-blue" : "text-foreground-muted/60 group-hover:text-foreground/80"
                                                )} strokeWidth={isActive ? 2.5 : 2} />
                                            </div>

                                            {/* Active indicator shadow */}
                                            {isActive && (
                                                <div className="absolute inset-x-2 inset-y-1.5 bg-background-secondary rounded-md -z-10 shadow-sm" />
                                            )}
                                        </Link>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="bg-foreground text-background border-none text-[12px] font-medium px-3 py-1.5 shadow-xl">
                                        {tab.label}
                                    </TooltipContent>
                                </Tooltip>
                            );
                        })}
                    </div>


                </aside>

                {/* Main Content Area */}
                <main className="flex-1 flex flex-col h-full min-w-0 bg-background overflow-hidden relative">
                    {/* Slim Header Bar */}
                    <header className="h-14 border-b border-border/40 bg-background/50 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-40">
                        <div className="flex items-center gap-4 min-w-0">
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
                                compact={true}
                                showLogo={false}
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                            {project.status === 'archived' && (
                                <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 gap-1 px-1.5 py-0.5 h-6 shrink-0 hidden sm:flex">
                                    <Archive className="h-2.5 w-2.5" />
                                    <span className="text-[9px] font-bold uppercase tracking-wider">{tc('archived')}</span>
                                </Badge>
                            )}

                            {(() => {
                                const sortedTabs = [...tabs].sort((a, b) => b.href.length - a.href.length);
                                const activeTab = sortedTabs.find(tab => pathname.includes(tab.href)) || tabs[0];
                                const isWalkthroughsTab = activeTab.key === 'walkthroughs';

                                return canCreateWalkthroughs && isWalkthroughsTab && (
                                    <Button
                                        onClick={() => setCreateOpen(true)}
                                        disabled={project.status === 'archived'}
                                        size="sm"
                                        className={cn(
                                            "h-8 gap-1.5 text-white shadow-sm cursor-pointer px-3 transition-all",
                                            project.status === 'archived'
                                                ? "bg-foreground-muted/20 opacity-50 cursor-not-allowed"
                                                : "bg-accent-blue hover:bg-accent-blue/90"
                                        )}
                                        title={project.status === 'archived' ? t('cannotCreateArchived') : undefined}
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        <span className="text-xs font-semibold hidden sm:inline">{t('newWalkthrough')}</span>
                                    </Button>
                                );
                            })()}

                            {canManageProject && (
                                <ProjectActionsMenu
                                    project={{ id, name: project.name, status: project.status }}
                                    onDeleteSuccess={() => router.push('/projects')}
                                    triggerClassName="h-8 w-8 hover:bg-background-secondary border border-border/30 rounded-md flex items-center justify-center cursor-pointer transition-colors"
                                />
                            )}
                        </div>
                    </header>
                    
                    {/* Standardized View Header */}
                    {(() => {
                        // Sort by length descending to match the most specific path first
                        const sortedTabs = [...tabs].sort((a, b) => b.href.length - a.href.length);
                        const activeTab = sortedTabs.find(tab => pathname.includes(tab.href)) || tabs[0];
                        
                        // Hide header on Lumen detail views (deeply nested lumen paths)
                        const isLumenDetail = pathname.match(/\/lumens\/[^\/]+$/);
                        if (isLumenDetail) return null;

                        return (
                            <div className="pt-8 px-6 pb-2 max-w-6xl mx-auto w-full shrink-0">
                                <h1 className="text-lg font-bold text-foreground tracking-tight">
                                    {activeTab.label}
                                </h1>
                                <p className="text-xs text-foreground-muted/70 mt-1 max-w-3xl">
                                    {t(`${activeTab.key}Subtitle`)}
                                </p>
                            </div>
                        );
                    })()}

                    {/* Actual Tab content — fills space */}
                    <div className="flex-1 min-h-0 relative flex flex-col h-full">
                        {children}
                    </div>
                </main>
            </div>
        </TooltipProvider>
    );
}
