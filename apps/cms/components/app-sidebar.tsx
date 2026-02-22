'use client';

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarFooter,
    useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FolderKanban, GitPullRequest, Inbox, Plus, ChevronDown, ChevronLeft, ChevronRight, Key, Settings, Rocket, Shield, Users, Building2 } from 'lucide-react';
import { useProjects, usePermissions, useProjectFavorites, useUnreadNotificationsCount } from '@luma/infra';
import { useState, useMemo } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useProjectSearch } from '@/components/project-search-context';
import { SearchInput } from '@/components/ui/search-input';
import { CreateApiKeyModal } from './modals/CreateApiKeyModal';
import { CreateWalkthroughModal } from './modals/CreateWalkthroughModal';
import { CreateProjectDialog } from './shared/CreateProjectDialog';
import { ProjectActionsMenu } from './shared/ProjectActionsMenu';
import { useTranslations } from 'next-intl';

export function AppSidebar() {
    const rawPathname = usePathname();
    // Strip locale prefix (e.g. /en/projects -> /projects) for route matching
    const pathname = useMemo(() => {
        const segments = rawPathname.split('/');
        if (segments.length > 1 && segments[1]?.length === 2) {
            return '/' + segments.slice(2).join('/');
        }
        return rawPathname;
    }, [rawPathname]);
    const t = useTranslations('Sidebar');
    const permissions = usePermissions();
    const { search, setSearch, debouncedSearch } = useProjectSearch();
    const {
        data,
        isLoading
    } = useProjects(debouncedSearch, 5, 0, { status: 'active' });

    const { data: unreadCount } = useUnreadNotificationsCount();

    const canCreateProjects = permissions.can('create', 'projects');

    // Favorites
    const { data: favoritesData } = useProjectFavorites();
    const favoritesList = Array.isArray(favoritesData) ? favoritesData : (favoritesData as any)?.data || [];

    const { toggleSidebar, state } = useSidebar();
    const isCollapsed = state === 'collapsed';
    const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
    const [walkthroughModalOpen, setWalkthroughModalOpen] = useState(false);
    const [createProjectOpen, setCreateProjectOpen] = useState(false);

    // Simplified projects list
    const allProjectsList = Array.isArray(data) ? data : data?.data || [];

    // Resolve favorite project IDs, then map to actual project data from the loaded list
    const favoriteProjectIds = new Set(favoritesList.map((f: any) => f.projectId));
    const favoriteProjects = allProjectsList.filter((p: any) => favoriteProjectIds.has(p.id));

    // Exclude favorites from the general projects list to avoid visual redundancy
    const projectsList = allProjectsList.filter((p: any) => !favoriteProjectIds.has(p.id));

    interface MenuItem {
        title: string;
        url: string;
        icon: React.ElementType;
        badge?: number;
    }

    const menuItems: MenuItem[] = [
        {
            title: t('dashboard'),
            url: '/',
            icon: Home,
        },
        {
            title: t('inbox'),
            url: '/inbox',
            icon: Inbox,
            badge: unreadCount ?? 0,
        },
        {
            title: t('allProjects'),
            url: '/projects',
            icon: FolderKanban,
        },
        {
            title: t('walkthroughs'),
            url: '/walkthroughs',
            icon: GitPullRequest,
        },
        {
            title: t('organizations'),
            url: '/organizations',
            icon: Building2,
        },
    ];

    return (
        <Sidebar collapsible="icon">
            <SidebarContent className="pt-2">
                <SidebarGroup>
                    <SidebarGroupLabel className="text-[11px] text-foreground-muted font-medium px-2 uppercase tracking-wider mb-0.5 group-data-[collapsible=icon]:hidden">
                        {t('workspace')}
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {menuItems.map((item) => {
                                const isActive = pathname === item.url;
                                return (
                                    <SidebarMenuItem key={item.url}>
                                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.title} className="px-2.5 py-1.5 h-8 font-medium text-[13px]">
                                            <Link href={item.url} className="transition-smooth flex items-center gap-2.5 w-full">
                                                <item.icon className="h-4 w-4 opacity-60 shrink-0" />
                                                <span className="group-data-[collapsible=icon]:hidden flex-1">{item.title}</span>
                                                {item.badge !== undefined && item.badge > 0 && (
                                                    <span className="h-4 min-w-[16px] px-1 rounded-full bg-accent-blue text-white text-[10px] font-bold flex items-center justify-center shadow-[0_0_6px_rgba(59,130,246,0.3)] leading-none group-data-[collapsible=icon]:hidden">
                                                        {item.badge > 99 ? '99+' : item.badge}
                                                    </span>
                                                )}
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                <CreateApiKeyModal open={apiKeyModalOpen} onOpenChange={setApiKeyModalOpen} />
                <CreateWalkthroughModal open={walkthroughModalOpen} onOpenChange={setWalkthroughModalOpen} />

                {/* Favorites Section */}
                {favoriteProjects.length > 0 && (
                    <Collapsible defaultOpen className="group/favorites">
                        <SidebarGroup className="mt-1">
                            <div className="flex items-center justify-between px-2 mb-1 group-data-[collapsible=icon]:hidden">
                                <SidebarGroupLabel asChild className="text-[11px] text-foreground-muted font-medium uppercase tracking-wider p-0 flex-1">
                                    <CollapsibleTrigger className="flex items-center gap-1.5 hover:text-foreground transition-colors group-data-[collapsible=icon]:hidden w-full">
                                        <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=open]/favorites:rotate-0 -rotate-90 shrink-0" />
                                        <span className="truncate">{t('favorites')}</span>
                                    </CollapsibleTrigger>
                                </SidebarGroupLabel>
                            </div>

                            <CollapsibleContent>
                                <SidebarGroupContent>
                                    <SidebarMenu>
                                        {favoriteProjects.map((project: any) => {
                                            const isActive = pathname.startsWith(`/projects/${project.id}`);
                                            return (
                                                <SidebarMenuItem
                                                    key={project.id}
                                                    className={cn(
                                                        "group/menu-item rounded-md transition-smooth hover:bg-sidebar-accent overflow-hidden",
                                                        isActive && "bg-sidebar-accent"
                                                    )}
                                                >
                                                    <div className="flex items-center w-full group-data-[collapsible=icon]:justify-center">
                                                        {isActive && (
                                                            <div className="w-[3px] h-4 rounded-full bg-accent-blue shrink-0 -ml-0.5 mr-0.5 group-data-[collapsible=icon]:hidden" />
                                                        )}
                                                        <SidebarMenuButton
                                                            asChild
                                                            isActive={isActive}
                                                            tooltip={project.name}
                                                            className={cn(
                                                                "flex-1 min-w-0 h-8 px-2 hover:bg-transparent transition-none group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center",
                                                                isActive && "bg-sidebar-accent"
                                                            )}
                                                        >
                                                            <Link href={`/projects/${project.id}`} className="flex items-center gap-2.5 w-full overflow-hidden">
                                                                <div className={cn(
                                                                    "flex items-center justify-center h-5 w-5 rounded shrink-0 border transition-colors",
                                                                    isActive
                                                                        ? "bg-accent-blue/15 border-accent-blue"
                                                                        : "bg-background-secondary border-border group-hover/menu-item:border-accent-blue/40"
                                                                )}>
                                                                    <span className={cn(
                                                                        "text-[10px] font-semibold uppercase leading-none",
                                                                        isActive
                                                                            ? "text-accent-blue"
                                                                            : "text-foreground-muted group-hover/menu-item:text-accent-blue"
                                                                    )}>
                                                                        {project.name.charAt(0)}
                                                                    </span>
                                                                </div>
                                                                <span className={cn(
                                                                    "truncate flex-1 text-[13px] group-data-[collapsible=icon]:hidden",
                                                                    isActive ? "font-semibold text-foreground" : "font-medium"
                                                                )}>{project.name}</span>
                                                            </Link>
                                                        </SidebarMenuButton>
                                                    </div>
                                                </SidebarMenuItem>
                                            );
                                        })}
                                    </SidebarMenu>
                                </SidebarGroupContent>
                            </CollapsibleContent>
                        </SidebarGroup>
                    </Collapsible>
                )}

                <Collapsible defaultOpen className="group/collapsible">
                    <SidebarGroup className="mt-1">
                        <div className="flex items-center justify-between px-2 mb-1 group-data-[collapsible=icon]:hidden">
                            <SidebarGroupLabel asChild className="text-[11px] text-foreground-muted font-medium uppercase tracking-wider p-0 flex-1">
                                <CollapsibleTrigger className="flex items-center gap-1.5 hover:text-foreground transition-colors group-data-[collapsible=icon]:hidden w-full">
                                    <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-0 -rotate-90 shrink-0" />
                                    <span className="truncate">{t('projects')}</span>
                                </CollapsibleTrigger>
                            </SidebarGroupLabel>
                            {canCreateProjects && (
                                <button
                                    onClick={() => setCreateProjectOpen(true)}
                                    className="text-foreground-muted hover:text-foreground transition-colors p-1 rounded hover:bg-background-secondary ml-1 shrink-0"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Search Input */}
                        <div className="px-2 mb-2 group-data-[collapsible=icon]:hidden">
                            <SearchInput
                                placeholder={t('searchPlaceholder')}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onClear={() => setSearch('')}
                                className="h-8 text-[13px] bg-background-secondary/50 border-transparent focus-visible:bg-background focus-visible:border-input"
                            />
                        </div>

                        <CollapsibleContent>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {projectsList.map((project: any) => {
                                        const isActive = pathname.startsWith(`/projects/${project.id}`);
                                        return (
                                            <SidebarMenuItem
                                                key={project.id}
                                                className={cn(
                                                    "group/menu-item rounded-md transition-smooth hover:bg-sidebar-accent overflow-hidden",
                                                    isActive && "bg-sidebar-accent"
                                                )}
                                            >
                                                <div className="flex items-center w-full group-data-[collapsible=icon]:justify-center">
                                                    {/* Active indicator bar */}
                                                    {isActive && (
                                                        <div className="w-[3px] h-4 rounded-full bg-accent-blue shrink-0 -ml-0.5 mr-0.5 group-data-[collapsible=icon]:hidden" />
                                                    )}
                                                    <SidebarMenuButton
                                                        asChild
                                                        isActive={isActive}
                                                        tooltip={project.name}
                                                        className={cn(
                                                            "flex-1 min-w-0 h-8 px-2 hover:bg-transparent transition-none group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center",
                                                            isActive && "bg-sidebar-accent"
                                                        )}
                                                    >
                                                        <Link href={`/projects/${project.id}`} className="flex items-center gap-2.5 w-full overflow-hidden">
                                                            <div className={cn(
                                                                "flex items-center justify-center h-5 w-5 rounded shrink-0 border transition-colors",
                                                                isActive
                                                                    ? "bg-accent-blue/15 border-accent-blue"
                                                                    : "bg-background-secondary border-border group-hover/menu-item:border-accent-blue/40"
                                                            )}>
                                                                <span className={cn(
                                                                    "text-[10px] font-semibold uppercase leading-none",
                                                                    isActive
                                                                        ? "text-accent-blue"
                                                                        : "text-foreground-muted group-hover/menu-item:text-accent-blue"
                                                                )}>
                                                                    {project.name.charAt(0)}
                                                                </span>
                                                            </div>
                                                            <span className={cn(
                                                                "truncate flex-1 text-[13px] group-data-[collapsible=icon]:hidden",
                                                                isActive ? "font-semibold text-foreground" : "font-medium"
                                                            )}>{project.name}</span>
                                                        </Link>
                                                    </SidebarMenuButton>
                                                    <div className="flex-shrink-0 flex items-center justify-center w-7 h-8 opacity-0 group-hover/menu-item:opacity-100 transition-opacity group-data-[collapsible=icon]:hidden">
                                                        <ProjectActionsMenu
                                                            project={project}
                                                            triggerClassName="h-6 w-6 rounded hover:bg-background-tertiary flex items-center justify-center p-0 transition-smooth"
                                                        />
                                                    </div>
                                                </div>
                                            </SidebarMenuItem>
                                        );
                                    })}

                                    {projectsList.length > 0 && (
                                        <SidebarMenuItem>
                                            <SidebarMenuButton asChild tooltip={t('viewAllProjects')} className="px-2.5 py-2 h-auto group text-accent-blue hover:text-accent-blue/80 justify-center">
                                                <Link href="/projects" className="transition-smooth flex items-center justify-center w-full">
                                                    <span className="text-xs font-semibold truncate group-data-[collapsible=icon]:hidden">{t('viewAllProjects')}</span>
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    )}

                                    {projectsList.length === 0 && !isLoading && (
                                        <div className="px-3 py-3 text-xs text-foreground-muted italic text-center group-data-[collapsible=icon]:hidden">
                                            {t('noProjectsFound')}
                                        </div>
                                    )}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </CollapsibleContent>
                    </SidebarGroup>
                </Collapsible>

                <CreateProjectDialog open={createProjectOpen} onOpenChange={setCreateProjectOpen} />

                {/* Setup Guide & Settings */}
                <SidebarGroup className="mt-1">
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip={t('setupGuide')} className="px-2.5 py-1.5 h-8 font-medium text-[13px]">
                                    <Link
                                        href="/onboarding?restart=true"
                                        className={cn(
                                            "transition-smooth flex items-center gap-2.5 rounded-md",
                                            "bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20",
                                            "group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:justify-center"
                                        )}
                                    >
                                        <Rocket className="h-4 w-4 shrink-0" />
                                        <span className="group-data-[collapsible=icon]:hidden">{t('setupGuide')}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={pathname === '/settings'} tooltip={t('settings')} className="px-2.5 py-1.5 h-8 font-medium text-[13px]">
                                    <Link href="/settings" className="transition-smooth flex items-center gap-2.5">
                                        <Settings className="h-4 w-4 opacity-60 shrink-0" />
                                        <span className="group-data-[collapsible=icon]:hidden">{t('settings')}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {/* Administration — superadmin only */}
                {permissions.isSuperAdmin() && (
                    <SidebarGroup className="mt-1">
                        <SidebarGroupLabel className="text-[11px] text-foreground-muted font-medium px-2 uppercase tracking-wider mb-0.5 group-data-[collapsible=icon]:hidden">
                            {t('administration')}
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild isActive={pathname.startsWith('/admin/users')} tooltip={t('usersManagement')} className="px-2.5 py-1.5 h-8 font-medium text-[13px]">
                                        <Link href="/admin/users" className="transition-smooth flex items-center gap-2.5">
                                            <Users className="h-4 w-4 opacity-60 shrink-0" />
                                            <span className="group-data-[collapsible=icon]:hidden">{t('usersManagement')}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild isActive={pathname.startsWith('/admin/roles')} tooltip={t('rolesManagement')} className="px-2.5 py-1.5 h-8 font-medium text-[13px]">
                                        <Link href="/admin/roles" className="transition-smooth flex items-center gap-2.5">
                                            <Shield className="h-4 w-4 opacity-60 shrink-0" />
                                            <span className="group-data-[collapsible=icon]:hidden">{t('rolesManagement')}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild isActive={pathname.startsWith('/admin/secrets')} tooltip={t('secretsManagement')} className="px-2.5 py-1.5 h-8 font-medium text-[13px]">
                                        <Link href="/admin/secrets" className="transition-smooth flex items-center gap-2.5">
                                            <Key className="h-4 w-4 opacity-60 shrink-0" />
                                            <span className="group-data-[collapsible=icon]:hidden">{t('secretsManagement')}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}

                {/* Quick Actions — only visible if user can create walkthroughs or API keys */}
                {(permissions.can('create', 'walkthroughs') || permissions.can('create', 'api_keys')) && (
                    <SidebarGroup className="mt-1">
                        <SidebarGroupLabel className="text-[11px] text-foreground-muted font-medium px-2 uppercase tracking-wider mb-0.5 group-data-[collapsible=icon]:hidden">
                            {t('quickActions')}
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {permissions.can('create', 'api_keys') && (
                                    <SidebarMenuItem>
                                        <SidebarMenuButton
                                            onClick={() => setApiKeyModalOpen(true)}
                                            tooltip={t('createApiKey')}
                                            className="px-2.5 py-1.5 h-8 font-medium text-[13px]"
                                        >
                                            <div className="transition-smooth flex items-center gap-2.5">
                                                <Key className="h-4 w-4 opacity-60 text-accent-blue shrink-0" />
                                                <span className="group-data-[collapsible=icon]:hidden">{t('createApiKey')}</span>
                                            </div>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                )}
                                {permissions.can('create', 'walkthroughs') && (
                                    <SidebarMenuItem>
                                        <SidebarMenuButton
                                            onClick={() => setWalkthroughModalOpen(true)}
                                            tooltip={t('createWalkthrough')}
                                            className="px-2.5 py-1.5 h-8 font-medium text-[13px]"
                                        >
                                            <div className="transition-smooth flex items-center gap-2.5">
                                                <GitPullRequest className="h-4 w-4 opacity-60 text-accent-blue shrink-0" />
                                                <span className="group-data-[collapsible=icon]:hidden">{t('createWalkthrough')}</span>
                                            </div>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                )}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}

            </SidebarContent>
            <SidebarFooter className="border-t border-sidebar-border p-1.5">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            className="w-full justify-center h-8 text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-all"
                            tooltip={isCollapsed ? t('expandSidebar') : t('collapseSidebar')}
                            onClick={toggleSidebar}
                        >
                            {isCollapsed ? (
                                <ChevronRight className="h-3.5 w-3.5" />
                            ) : (
                                <div className="flex items-center gap-2 w-full px-1">
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                    <span className="text-xs font-medium">{t('collapse')}</span>
                                </div>
                            )}
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
