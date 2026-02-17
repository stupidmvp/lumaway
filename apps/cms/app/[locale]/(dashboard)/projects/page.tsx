'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useProjects, useProjectFavorites } from '@luma/infra';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
import {
    FolderKanban,
    ChevronLeft,
    ChevronRight,
    MoreVertical,
    Calendar,

    Pencil,
    Trash2,
    Archive,
    CheckCircle,
    Star
} from 'lucide-react';
import { useDebounce } from 'use-debounce';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ProjectsHeader } from '@/components/projects/ProjectsHeader';
import { FilterButton } from '@/components/shared/FilterButton';

import { ProjectCard } from '@/components/projects/ProjectCard';

import { MainContent } from '@/components/shared/MainContent';
import { StandardToolbar } from '@/components/shared/StandardToolbar';
import { StandardPagination } from '@/components/shared/StandardPagination';
import { useTranslations } from 'next-intl';

export default function ProjectsPage() {
    const [search, setSearch] = useState('');
    const [debouncedSearch] = useDebounce(search, 300);
    const [page, setPage] = useState(0);
    const [statusFilter, setStatusFilter] = useState<string>('active');
    const limit = 9;
    const t = useTranslations('Projects');
    const tc = useTranslations('Common');

    const isFavoritesFilter = statusFilter === 'favorites';

    const { data: projectsData, isLoading, isFetching, error } = useProjects(
        debouncedSearch,
        isFavoritesFilter ? 100 : limit,
        isFavoritesFilter ? 0 : page * limit,
        { status: isFavoritesFilter ? 'active' : statusFilter }
    );

    const { data: favoritesData } = useProjectFavorites();
    const favoriteProjectIds = useMemo(() => {
        const favs = Array.isArray(favoritesData) ? favoritesData : (favoritesData as any)?.data || [];
        return new Set(favs.map((f: any) => f.projectId));
    }, [favoritesData]);

    const allProjectsList = Array.isArray(projectsData)
        ? projectsData
        : (projectsData as any)?.data || [];

    const projectsList = isFavoritesFilter
        ? allProjectsList.filter((p: any) => favoriteProjectIds.has(p.id))
        : allProjectsList;

    const total = isFavoritesFilter
        ? projectsList.length
        : (Array.isArray(projectsData)
            ? (projectsData as any).total ?? allProjectsList.length
            : (projectsData as any)?.total || allProjectsList.length);

    const totalPages = Math.ceil(total / limit);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh]">
                <div className="p-4 bg-red-500/10 rounded-full mb-4">
                    <FolderKanban className="h-8 w-8 text-red-500" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">{t('errorLoading')}</h2>
                <p className="text-sm text-foreground-muted">{t('errorLoadingDescription')}</p>
                <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
                    {tc('retry')}
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background transition-colors duration-300">
            <ProjectsHeader />

            <MainContent>
                <StandardToolbar
                    search={search}
                    onSearchChange={(val) => {
                        setSearch(val);
                        setPage(0);
                    }}
                    onSearchClear={() => {
                        setSearch('');
                        setPage(0);
                    }}
                    filterValue={statusFilter}
                    onFilterChange={(val) => {
                        setStatusFilter(val);
                        setPage(0);
                    }}
                    filterOptions={[
                        { label: tc('active'), value: 'active', icon: CheckCircle },
                        { label: tc('archived'), value: 'archived', icon: Archive },
                        { label: t('favorites'), value: 'favorites', icon: Star },
                    ]}
                    placeholder={t('searchProjects')}
                />

                {/* Projects Grid */}
                <div className="relative">
                    {/* Subtle fetching overlay — only during refetch (not initial load) */}
                    {isFetching && !isLoading && (
                        <div className="absolute inset-0 bg-background/50 z-10 flex items-center justify-center rounded-xl pointer-events-none" />
                    )}

                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="flex flex-col p-6 w-full h-[230px] rounded-2xl border border-border/40 bg-background animate-pulse">
                                    {/* Header: icon + menu */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="h-12 w-12 rounded-xl bg-foreground-muted/10" />
                                        <div className="h-8 w-8 rounded-lg bg-foreground-muted/10" />
                                    </div>
                                    {/* Title + status */}
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="h-5 w-36 rounded bg-foreground-muted/10" />
                                        <div className="h-2 w-2 rounded-full bg-foreground-muted/10" />
                                        <div className="h-3 w-12 rounded bg-foreground-muted/10" />
                                    </div>
                                    {/* Owner avatar + name */}
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="h-6 w-6 rounded-full bg-foreground-muted/10" />
                                        <div className="h-3 w-24 rounded bg-foreground-muted/10" />
                                    </div>
                                    {/* Stats row */}
                                    <div className="flex items-center gap-4 mt-auto">
                                        <div className="flex items-center gap-1.5">
                                            <div className="h-3 w-3 rounded bg-foreground-muted/10" />
                                            <div className="h-3 w-20 rounded bg-foreground-muted/10" />
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="h-3 w-3 rounded bg-foreground-muted/10" />
                                            <div className="h-3 w-20 rounded bg-foreground-muted/10" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : projectsList && projectsList.length > 0 ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                                {projectsList.map((p: any) => (
                                    <ProjectCard key={p.id} project={p} />
                                ))}
                            </div>

                            <StandardPagination
                                page={page}
                                totalPages={totalPages}
                                onPageChange={setPage}
                                totalResults={total}
                                limit={limit}
                                resultsOnPage={projectsList.length}
                            />
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 bg-background-secondary/10 rounded-3xl border-2 border-dashed border-border/50">
                            <div className="p-6 bg-background rounded-full shadow-inner mb-6">
                                <FolderKanban className="h-12 w-12 text-foreground-subtle opacity-20" />
                            </div>
                            <h2 className="text-xl font-semibold text-foreground">{t('noProjectsFound')}</h2>
                            <p className="text-foreground-muted mt-2 max-w-xs text-center">
                                {debouncedSearch ? t('noProjectsMatchSearch', { search: debouncedSearch }) : t('getStarted')}
                            </p>
                            {debouncedSearch && (
                                <Button variant="link" onClick={() => setSearch('')} className="mt-2 text-accent-blue cursor-pointer">
                                    {tc('clearSearch')}
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </MainContent>
        </div>
    );
}
