
'use client';

import { useState, useMemo, useCallback } from 'react';
import { useWalkthroughs, useActors } from '@luma/infra';
import { useDebounce } from 'use-debounce';
import {
    GitPullRequest,
    CheckCircle,
    FileEdit,
    SearchX,
    Tag,
    UserCog,
    X,
    ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WalkthroughCard } from './WalkthroughCard';
import { getActorColor } from '@/components/project-detail/ActorsPanel';
import { cn } from '@/lib/utils';

import { StandardToolbar } from './StandardToolbar';
import { StandardPagination } from './StandardPagination';
import { FilterButton } from '@/components/shared/FilterButton';
import { useTranslations } from 'next-intl';

interface WalkthroughsListProps {
    projectId?: string;
    title?: string;
    description?: string;
}

/** A group is either a parent with its children, or a standalone walkthrough */
interface WalkthroughGroup {
    parent: any;
    children: any[];
}

export function WalkthroughsList({ projectId, title, description }: WalkthroughsListProps) {
    const [search, setSearch] = useState('');
    const [debouncedSearch] = useDebounce(search, 300);
    const [page, setPage] = useState(0);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [tagFilter, setTagFilter] = useState<string[]>([]);
    const [actorFilter, setActorFilter] = useState<string | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const limit = 50;
    const t = useTranslations('Walkthroughs');
    const tc = useTranslations('Common');

    // Fetch actors for the project so we can show actor filter options
    const { data: projectActors } = useActors(projectId);

    const filters: any = { projectId };
    if (statusFilter !== 'all') {
        filters.isPublished = statusFilter === 'published';
    }
    if (tagFilter.length > 0) {
        filters.tags = tagFilter;
    }
    if (actorFilter) {
        filters.actorId = actorFilter;
    }

    const { data: walkthroughsData, isLoading, isFetching, error } = useWalkthroughs(
        debouncedSearch,
        limit,
        page * limit,
        filters
    );

    const walkthroughsList = Array.isArray(walkthroughsData)
        ? walkthroughsData
        : (walkthroughsData as any)?.data || [];

    const total = Array.isArray(walkthroughsData)
        ? (walkthroughsData as any).total ?? walkthroughsList.length
        : (walkthroughsData as any)?.total || walkthroughsList.length;

    const totalPages = Math.ceil(total / limit);

    // ── Group walkthroughs by parent ─────────────────────────────────
    const groups = useMemo((): WalkthroughGroup[] => {
        if (!walkthroughsList.length) return [];

        const byId = new Map<string, any>();
        const childrenOf = new Map<string, any[]>();
        const roots: any[] = [];
        const orphans: any[] = [];

        // Index all walkthroughs by id
        for (const w of walkthroughsList) {
            byId.set(w.id, w);
        }

        // Classify: root vs child
        for (const w of walkthroughsList) {
            if (!w.parentId) {
                roots.push(w);
            } else if (byId.has(w.parentId)) {
                // Parent is in the current page — group under it
                const children = childrenOf.get(w.parentId) || [];
                children.push(w);
                childrenOf.set(w.parentId, children);
            } else {
                // Parent not in current page — treat as orphan root
                orphans.push(w);
            }
        }

        const result: WalkthroughGroup[] = [];

        // Root walkthroughs with their children
        for (const root of roots) {
            const children = childrenOf.get(root.id) || [];
            result.push({ parent: root, children });
        }

        // Orphans (children whose parent isn't in this page) as standalone groups
        for (const orphan of orphans) {
            result.push({ parent: orphan, children: [] });
        }

        return result;
    }, [walkthroughsList]);

    // Extract unique tags from the currently visible walkthroughs for display
    const visibleTags = useMemo(() => {
        const tagSet = new Set<string>();
        walkthroughsList.forEach((w: any) => {
            (w.tags ?? []).forEach((t: string) => tagSet.add(t));
        });
        return Array.from(tagSet).sort();
    }, [walkthroughsList]);

    const handleTagClick = useCallback((tag: string) => {
        setTagFilter(prev => {
            if (prev.includes(tag)) return prev.filter(t => t !== tag);
            return [...prev, tag];
        });
        setPage(0);
    }, []);

    const clearTagFilter = useCallback(() => {
        setTagFilter([]);
        setPage(0);
    }, []);

    const handleActorClick = useCallback((actorId: string) => {
        setActorFilter(prev => prev === actorId ? null : actorId);
        setPage(0);
    }, []);

    const clearActorFilter = useCallback(() => {
        setActorFilter(null);
        setPage(0);
    }, []);

    const toggleGroupExpand = useCallback((parentId: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(parentId)) {
                next.delete(parentId);
            } else {
                next.add(parentId);
            }
            return next;
        });
    }, []);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-red-500/5 rounded-3xl border border-red-500/10">
                <div className="p-4 bg-red-500/10 rounded-full mb-4">
                    <GitPullRequest className="h-8 w-8 text-red-500" />
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
        <div className="w-full space-y-6">
            {(title || description) && (
                <div className="mb-2">
                    {title && <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>}
                    {description && <p className="text-foreground-muted mt-1">{description}</p>}
                </div>
            )}

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
                    { label: tc('all'), value: 'all' },
                    { label: tc('published'), value: 'published', icon: CheckCircle },
                    { label: t('drafts'), value: 'draft', icon: FileEdit },
                ]}
                placeholder={t('searchWalkthroughs')}
                actions={
                    projectActors && projectActors.length > 0 ? (
                        <FilterButton
                            title={t('filterByActor')}
                            value={actorFilter || 'all'}
                            onChange={(val) => {
                                setActorFilter(val === 'all' ? null : val);
                                setPage(0);
                            }}
                            options={projectActors.map((actor) => ({
                                label: actor.name,
                                value: actor.id,
                                icon: UserCog,
                            }))}
                        />
                    ) : undefined
                }
            />

            {/* Active filter pills */}
            {(tagFilter.length > 0 || actorFilter) && (
                <div className="flex items-center gap-4 flex-wrap">
                    {/* Active tag filters */}
                    {tagFilter.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-foreground-muted font-medium flex items-center gap-1">
                                <Tag className="h-3 w-3" />
                                {t('filterByTags')}:
                            </span>
                            {tagFilter.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => handleTagClick(tag)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-accent-blue/10 text-accent-blue border border-accent-blue/20 hover:bg-accent-blue/20 transition-colors"
                                >
                                    {tag}
                                    <X className="h-2.5 w-2.5" />
                                </button>
                            ))}
                            <button
                                onClick={clearTagFilter}
                                className="text-[11px] text-foreground-muted hover:text-foreground transition-colors underline"
                            >
                                {tc('clearFilter')}
                            </button>
                        </div>
                    )}

                    {/* Active actor filter */}
                    {actorFilter && (() => {
                        const actor = projectActors?.find(a => a.id === actorFilter);
                        if (!actor) return null;
                        const colorDef = getActorColor(actor.color);
                        return (
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-foreground-muted font-medium flex items-center gap-1">
                                    <UserCog className="h-3 w-3" />
                                    {t('filterByActor')}:
                                </span>
                                <button
                                    onClick={clearActorFilter}
                                    className={cn(
                                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors',
                                        colorDef.bg,
                                        colorDef.text,
                                        'hover:opacity-80',
                                    )}
                                >
                                    <span className={cn('h-1.5 w-1.5 rounded-full', colorDef.dot)} />
                                    {actor.name}
                                    <X className="h-2.5 w-2.5" />
                                </button>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Walkthroughs List — Grouped by parent */}
            <div className="space-y-3 relative">
                {/* Subtle fetching overlay — only during refetch (not initial load) */}
                {isFetching && !isLoading && (
                    <div className="absolute inset-0 bg-background/50 z-10 flex items-center justify-center rounded-xl pointer-events-none" />
                )}

                {isLoading ? (
                    /* Skeleton groups */
                    [...Array(3)].map((_, gi) => (
                        <div key={gi} className="space-y-0">
                            <div className="flex items-center gap-4 px-5 py-4 rounded-lg border border-border/40 bg-background-secondary/20 animate-pulse">
                                <div className="h-10 w-10 rounded-lg bg-foreground-muted/10" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 w-40 rounded bg-foreground-muted/10" />
                                    <div className="h-3 w-60 rounded bg-foreground-muted/10" />
                                </div>
                                <div className="h-5 w-16 rounded-full bg-foreground-muted/10" />
                            </div>
                            {gi < 2 && (
                                <div className="ml-8 pl-4 border-l-2 border-border/30 space-y-0 mt-0">
                                    {[...Array(2)].map((_, ci) => (
                                        <div key={ci} className="flex items-center gap-4 px-4 py-3 animate-pulse">
                                            <div className="h-8 w-8 rounded-md bg-foreground-muted/10" />
                                            <div className="flex-1 space-y-2">
                                                <div className="h-3.5 w-32 rounded bg-foreground-muted/10" />
                                                <div className="h-3 w-48 rounded bg-foreground-muted/10" />
                                            </div>
                                            <div className="h-4 w-14 rounded-full bg-foreground-muted/10" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                ) : groups.length > 0 ? (
                    groups.map((group) => {
                        const hasChildren = group.children.length > 0;
                        const isExpanded = expandedGroups.has(group.parent.id);

                        return (
                            <div key={group.parent.id} className="group/row space-y-0">
                                {/* Parent card */}
                                <div className="relative">
                                    {hasChildren && (
                                        <button
                                            onClick={() => toggleGroupExpand(group.parent.id)}
                                            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 flex items-center justify-center h-5 w-5 rounded-full border border-border bg-background hover:bg-background-secondary text-foreground-muted hover:text-foreground transition-all shadow-sm cursor-pointer opacity-0 group-hover/row:opacity-100"
                                            title={isExpanded ? t('collapseGroup') : t('expandGroup')}
                                        >
                                            <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                        </button>
                                    )}
                                    <WalkthroughCard
                                        walkthrough={group.parent}
                                        onTagClick={handleTagClick}
                                        onActorClick={handleActorClick}
                                        childCount={group.children.length}
                                    />
                                </div>

                                {/* Children — nested under parent */}
                                {hasChildren && isExpanded && (
                                    <div className="ml-5 pl-4 border-l-2 border-border/40 space-y-0 pt-1 pb-1">
                                        {group.children.map((child) => (
                                            <WalkthroughCard
                                                key={child.id}
                                                walkthrough={child}
                                                onTagClick={handleTagClick}
                                                onActorClick={handleActorClick}
                                                isChild
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 bg-background-secondary/5 border-2 border-dashed border-border/50 rounded-3xl">
                        <div className="p-6 bg-background rounded-full shadow-inner mb-6">
                            <SearchX className="h-12 w-12 text-foreground-subtle opacity-20" />
                        </div>
                        <h2 className="text-xl font-semibold text-foreground">{t('noWalkthroughsFound')}</h2>
                        <p className="text-foreground-muted mt-2 max-w-xs text-center">
                            {search ? t('noWalkthroughsMatchSearch', { search }) : t('getStarted')}
                        </p>
                        {(search || tagFilter.length > 0 || actorFilter) && (
                            <Button
                                variant="link"
                                onClick={() => { setSearch(''); clearTagFilter(); clearActorFilter(); }}
                                className="mt-2 text-accent-blue font-medium cursor-pointer"
                            >
                                {tc('clearSearch')}
                            </Button>
                        )}
                    </div>
                )}
            </div>

            <StandardPagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalResults={total}
                limit={limit}
                resultsOnPage={walkthroughsList.length}
            />
        </div>
    );
}
