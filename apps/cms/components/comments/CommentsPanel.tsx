'use client';

import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { X, MessageCircle, ChevronUp, Search, SlidersHorizontal, CalendarDays, AlertCircle, Megaphone } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import {
    useComments,
    useCreateComment,
    useUpdateComment,
    useArchiveComment,
    useSoftDeleteComment,
    useRestoreComment,
    useResolveCorrection,
    useRemoveAttachments,
    useToggleReaction,
} from '@luma/infra';
import type { Comment, CommentType } from '@luma/infra';
import { useTranslations } from 'next-intl';
import { useDebounce } from 'use-debounce';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Autocomplete } from '@/components/ui/autocomplete';
import { SearchInput } from '@/components/ui/search-input';
import { FilterButton } from '@/components/shared/FilterButton';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { CommentInput } from './CommentInput';
import { CommentItem } from './CommentItem';
import { ThreadPanel } from './ThreadPanel';
import type { CommentInputHandle, PendingAttachment, EditingComment } from './CommentInput';

export interface WalkthroughStepInfo {
    id: string;
    title: string;
}

type FilterType = 'all' | 'comment' | 'correction' | 'announcement';
type ScopeType = 'current_step' | 'all';

const PANEL_PAGE_SIZE = 15;

export interface CommentsPanelProps {
    projectId: string;
    /** If provided, scopes to a walkthrough */
    walkthroughId?: string;
    /** Current step ID — used to auto-tag new comments with the active step */
    stepId?: string;
    /** Steps data for showing step association labels on comments */
    steps?: WalkthroughStepInfo[];
    /** Callback to close the panel */
    onClose?: () => void;
    /** Additional classes for the container */
    className?: string;
    /** When false, the comment input is hidden (viewer cannot comment per project settings) */
    canComment?: boolean;
    /** When false, hides the section header (useful when panel is already inside a labelled tab) */
    showHeader?: boolean;
}

export function CommentsPanel({
    projectId,
    walkthroughId,
    stepId,
    steps,
    onClose,
    className,
    canComment = true,
    showHeader = true,
}: CommentsPanelProps) {
    const t = useTranslations('Comments');
    const searchParams = useSearchParams();

    // When in walkthrough context with a step selected, default to "current_step"
    const hasStepScope = !!(walkthroughId && stepId);
    const [scope, setScope] = useState<ScopeType>(hasStepScope ? 'current_step' : 'all');
    const [filter, setFilter] = useState<FilterType>('all');
    const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
    const [editingComment, setEditingComment] = useState<EditingComment | null>(null);
    const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
    const [visibleRootCount, setVisibleRootCount] = useState(PANEL_PAGE_SIZE);
    const [hasInitiallyScrolled, setHasInitiallyScrolled] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<CommentInputHandle>(null);
    const prevScrollHeightRef = useRef<number | null>(null);

    // Advanced filters state
    const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch] = useDebounce(searchInput, 300);
    const [authorFilter, setAuthorFilter] = useState<string>('');
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');

    // Build a step lookup map for display labels
    const stepsMap = useMemo(() => {
        const map = new Map<string, { title: string; index: number }>();
        (steps || []).forEach((s, idx) => {
            map.set(s.id, { title: s.title, index: idx });
        });
        return map;
    }, [steps]);

    // ── Build dynamic query for backend filtering ─────────────────────
    const commentsQuery = useMemo(() => {
        const q: Record<string, any> = {
            projectId,
            $limit: 500,
        };

        // Scope: walkthrough step or project-wide
        if (walkthroughId && scope === 'current_step' && stepId) {
            q.targetId = walkthroughId;
            q.stepId = stepId;
            q.$sort = { createdAt: '1' };
        } else if (walkthroughId && scope === 'current_step') {
            q.targetId = walkthroughId;
            q.$sort = { createdAt: '1' };
        } else {
            q.$sort = { createdAt: '-1' };
        }

        // Type filter (comment | correction | announcement)
        if (filter !== 'all') {
            q.type = filter;
        }

        // Advanced filters — handled server-side
        if (authorFilter) {
            q.authorId = authorFilter;
        }
        if (debouncedSearch.trim()) {
            q.search = debouncedSearch.trim();
        }
        if (dateFrom) {
            q.dateFrom = dateFrom;
        }
        if (dateTo) {
            q.dateTo = dateTo;
        }

        return q;
    }, [projectId, walkthroughId, scope, stepId, filter, authorFilter, debouncedSearch, dateFrom, dateTo]);

    // Fetch comments with all filters applied server-side
    const activeQuery = useComments(commentsQuery);
    const allComments: Comment[] = activeQuery.data?.data || [];
    const isLoading = activeQuery.isLoading;

    // Count active advanced filters (only author & date — search is always visible)
    const activeAdvancedFilterCount = useMemo(() => {
        let count = 0;
        if (authorFilter) count++;
        if (dateFrom) count++;
        if (dateTo) count++;
        return count;
    }, [authorFilter, dateFrom, dateTo]);

    const clearAdvancedFilters = useCallback(() => {
        setAuthorFilter('');
        setDateFrom('');
        setDateTo('');
    }, []);

    // When the active step changes, auto-reset scope to "current_step"
    useEffect(() => {
        if (hasStepScope) {
            setScope('current_step');
            setHasInitiallyScrolled(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stepId]);

    // Root comments — filtering is done server-side; client only separates roots from replies
    const rootComments = useMemo(() => {
        return allComments
            .filter((c) => !c.parentId)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }, [allComments]);

    // Virtual pagination: show only the latest N root comments
    const hasOlderComments = rootComments.length > visibleRootCount;
    const olderCount = Math.max(0, rootComments.length - visibleRootCount);
    const displayedRoots = hasOlderComments
        ? rootComments.slice(rootComments.length - visibleRootCount)
        : rootComments;

    // Reset visible count when any filter changes
    useEffect(() => {
        setVisibleRootCount(PANEL_PAGE_SIZE);
        setHasInitiallyScrolled(false);
    }, [filter, scope, debouncedSearch, authorFilter, dateFrom, dateTo]);

    // Scroll position restoration after loading previous messages
    useLayoutEffect(() => {
        if (prevScrollHeightRef.current !== null && scrollRef.current) {
            const scrollEl = scrollRef.current;
            const newHeight = scrollEl.scrollHeight;
            scrollEl.scrollTop = newHeight - prevScrollHeightRef.current;
            prevScrollHeightRef.current = null;
        }
    });

    // Auto-scroll to bottom on initial data load
    useEffect(() => {
        if (!isLoading && allComments.length > 0 && !hasInitiallyScrolled) {
            setTimeout(() => {
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
            }, 50);
            setHasInitiallyScrolled(true);
        }
    }, [isLoading, allComments.length, hasInitiallyScrolled]);

    // Scroll to a specific comment when navigated from a notification
    useEffect(() => {
        const targetCommentId = searchParams.get('commentId');
        if (!targetCommentId || isLoading || allComments.length === 0) return;

        // If the target is a reply, open its parent thread
        const targetComment = allComments.find((c) => c.id === targetCommentId);
        if (targetComment?.parentId) {
            setActiveThreadId(targetComment.parentId);
            return;
        }

        // Find if the target root comment is beyond the visible window
        const targetRoot = targetComment;
        if (targetRoot) {
            const rootIndex = rootComments.findIndex((c) => c.id === targetRoot.id);
            if (rootIndex >= 0) {
                const neededVisible = rootComments.length - rootIndex;
                if (neededVisible > visibleRootCount) {
                    setVisibleRootCount(neededVisible);
                }
            }
        }

        setTimeout(() => {
            const el = document.getElementById(`comment-float-${targetCommentId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setHighlightedCommentId(targetCommentId);
                setTimeout(() => setHighlightedCommentId(null), 3000);
            }
        }, 300);
    }, [searchParams, isLoading, allComments, rootComments, visibleRootCount]);

    // Mutations
    const createComment = useCreateComment();
    const updateComment = useUpdateComment();
    const archiveComment = useArchiveComment();
    const softDeleteComment = useSoftDeleteComment();
    const restoreComment = useRestoreComment();
    const resolveCorrection = useResolveCorrection();
    const removeAttachments = useRemoveAttachments();
    const toggleReaction = useToggleReaction();

    const scrollToBottom = useCallback(() => {
        setTimeout(() => {
            scrollRef.current?.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: 'smooth',
            });
        }, 150);
    }, []);

    const loadPreviousMessages = useCallback(() => {
        const scrollEl = scrollRef.current;
        if (scrollEl) {
            prevScrollHeightRef.current = scrollEl.scrollHeight;
        }
        setVisibleRootCount((prev) => prev + PANEL_PAGE_SIZE);
    }, []);

    const targetType = walkthroughId && stepId
        ? 'walkthrough_step'
        : walkthroughId
            ? 'walkthrough'
            : 'project';

    const handleSubmit = async (content: string, type: CommentType, attachments?: PendingAttachment[]) => {
        try {
            await createComment.mutateAsync({
                projectId,
                content,
                type,
                targetType: targetType as any,
                targetId: walkthroughId || undefined,
                stepId: stepId || undefined,
                attachments,
            });
            toast.success(t('commentCreated'));
            scrollToBottom();
        } catch {
            toast.error(t('commentCreateFailed'));
        }
    };

    const handleThreadReply = async (content: string, type: CommentType, attachments?: PendingAttachment[]) => {
        if (!activeThreadId) return;
        try {
            await createComment.mutateAsync({
                projectId,
                content,
                type,
                parentId: activeThreadId,
                targetType: targetType as any,
                targetId: walkthroughId || undefined,
                stepId: stepId || undefined,
                attachments,
            });
            toast.success(t('commentCreated'));
        } catch {
            toast.error(t('commentCreateFailed'));
        }
    };

    const handleStartEdit = useCallback((commentId: string, content: string) => {
        setEditingComment({ id: commentId, content });
        // Focus will be handled by CommentInput via the editingComment effect
    }, []);

    const handleCancelEdit = useCallback(() => {
        setEditingComment(null);
    }, []);

    const handleEditSubmit = async (commentId: string, content: string) => {
        try {
            await updateComment.mutateAsync({ id: commentId, data: { content } });
            setEditingComment(null);
            toast.success(t('commentUpdated'));
        } catch {
            toast.error(t('commentUpdateFailed'));
        }
    };

    const handleDelete = async (commentId: string) => {
        try {
            await softDeleteComment.mutateAsync(commentId);
            toast.success(t('commentDeleted'));
        } catch {
            toast.error(t('commentDeleteFailed'));
        }
    };

    const handleArchive = async (commentId: string) => {
        try {
            await archiveComment.mutateAsync(commentId);
            toast.success(t('commentArchived'));
        } catch {
            toast.error(t('commentArchiveFailed'));
        }
    };

    const handleRestore = async (commentId: string) => {
        try {
            await restoreComment.mutateAsync(commentId);
            toast.success(t('commentRestored'));
        } catch {
            toast.error(t('commentRestoreFailed'));
        }
    };

    const handleResolve = async (commentId: string) => {
        try {
            await resolveCorrection.mutateAsync(commentId);
            toast.success(t('correctionResolved'));
        } catch {
            toast.error(t('correctionResolveFailed'));
        }
    };

    const handleRemoveAttachment = async (commentId: string, attachmentId: string) => {
        try {
            await removeAttachments.mutateAsync({ commentId, attachmentIds: [attachmentId] });
            toast.success(t('attachmentRemoved'));
        } catch {
            toast.error(t('attachmentRemoveFailed'));
        }
    };

    const handleToggleReaction = (commentId: string, emoji: string) => {
        toggleReaction.mutate({ commentId, emoji });
    };

    const getReplies = (parentId: string): Comment[] =>
        allComments
            .filter((c) => c.parentId === parentId)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const getRepliesCount = (parentId: string): number =>
        allComments.filter((c) => c.parentId === parentId).length;

    // Thread panel data
    const activeThreadComment = activeThreadId
        ? allComments.find((c) => c.id === activeThreadId) ?? null
        : null;
    const activeThreadReplies = activeThreadId ? getReplies(activeThreadId) : [];

    const scopeLabel = walkthroughId
        ? t('walkthroughDiscussion')
        : t('projectDiscussion');

    const filterOptions: { value: string; label: string; icon?: React.ComponentType<{ className?: string }> }[] = [
        { value: 'all', label: t('filterAll') },
        { value: 'comment', label: t('filterComments') },
        { value: 'correction', label: t('filterCorrections'), icon: AlertCircle },
        { value: 'announcement', label: t('filterAnnouncements'), icon: Megaphone },
    ];

    return (
        <div className={cn(
            "flex flex-col",
            className
        )}>
            {/* Section label — flat, matches editor section headers */}
            {showHeader && (
                <div className="flex items-center justify-between mb-3 shrink-0">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">{t('panelTitle')}</h2>
                        <span className="text-[10px] text-foreground-muted/60">{scopeLabel}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-1 hover:bg-background-tertiary rounded-md transition-colors text-foreground-muted hover:text-foreground cursor-pointer"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Search + Filter bar */}
            <div className="mb-4 shrink-0 space-y-3">
                {/* Search + filters row */}
                <div className="flex items-center justify-between gap-3">
                    {/* Search input — standard system component */}
                    <div className="w-full max-w-[240px]">
                        <SearchInput
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onClear={() => setSearchInput('')}
                            placeholder={t('searchPlaceholder')}
                            className="bg-transparent border-none shadow-none focus-within:bg-accent/30 h-9"
                            wrapperClassName="h-9 flex-1"
                        />
                    </div>

                    {/* Filters row */}
                    <div className="flex items-center gap-2 shrink-0">
                        {/* Scope toggle — only in walkthrough step context */}
                        {hasStepScope && (
                            <button
                                role="switch"
                                aria-checked={scope === 'current_step'}
                                onClick={() => setScope(scope === 'current_step' ? 'all' : 'current_step')}
                                className="group/switch flex items-center gap-2 cursor-pointer select-none h-9 px-2 rounded-md hover:bg-accent/50 transition-colors"
                            >
                                <span className={cn(
                                    "relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-200",
                                    scope === 'current_step'
                                        ? "bg-accent-blue"
                                        : "bg-foreground-muted/20"
                                )}>
                                    <span className={cn(
                                        "pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-200",
                                        scope === 'current_step'
                                            ? "translate-x-[14px]"
                                            : "translate-x-0.5"
                                    )} />
                                </span>
                                <span className={cn(
                                    "text-xs font-medium whitespace-nowrap transition-colors",
                                    scope === 'current_step'
                                        ? "text-accent-blue"
                                        : "text-foreground-muted"
                                )}>
                                    {t('scopeCurrentStep')}
                                </span>
                            </button>
                        )}

                        {/* Type filter — standard FilterButton */}
                        <FilterButton
                            title={t('filterAll')}
                            value={filter}
                            onChange={(val) => setFilter(val as FilterType)}
                            options={filterOptions}
                            variant="ghost"
                            className="h-9 min-w-[120px] px-2"
                        />

                        <Popover open={advancedFiltersOpen} onOpenChange={setAdvancedFiltersOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        "h-9 px-2.5 gap-2 text-foreground-muted hover:text-foreground",
                                        (advancedFiltersOpen || activeAdvancedFilterCount > 0)
                                        && "bg-accent/40 text-foreground"
                                    )}
                                >
                                    <SlidersHorizontal className="h-3.5 w-3.5" />
                                    <span className="text-xs font-medium">{t('advancedFilters')}</span>
                                    {activeAdvancedFilterCount > 0 && (
                                        <span className="inline-flex items-center justify-center h-4.5 min-w-4.5 px-1 text-[10px] font-bold rounded-full bg-accent-blue text-white">
                                            {activeAdvancedFilterCount}
                                        </span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-80 p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold text-foreground">{t('advancedFilters')}</h4>
                                    {activeAdvancedFilterCount > 0 && (
                                        <button
                                            onClick={clearAdvancedFilters}
                                            className="text-xs text-accent-blue hover:underline cursor-pointer flex items-center gap-1"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                            {t('clearFilters')}
                                        </button>
                                    )}
                                </div>

                                {/* Author filter — Autocomplete backed by project-members */}
                                <Autocomplete
                                    value={authorFilter}
                                    onValueChange={(value) => setAuthorFilter(value ? String(value) : '')}
                                    service="project-members"
                                    optionValue="userId"
                                    optionLabel={(_userId, item) => {
                                        if (item?.user) {
                                            return `${item.user.firstName} ${item.user.lastName}`.trim();
                                        }
                                        return String(_userId);
                                    }}
                                    label={t('filterByAuthor')}
                                    placeholder={t('selectAuthor')}
                                    filterDefaultValues={{ projectId, $includeOwner: 'true' }}
                                    allowClear
                                    limit={50}
                                />

                                {/* Date range */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-foreground-muted flex items-center gap-1.5">
                                            <CalendarDays className="h-3.5 w-3.5" />
                                            {t('filterByDateFrom')}
                                        </Label>
                                        <DatePicker
                                            value={dateFrom}
                                            onChange={setDateFrom}
                                            max={dateTo || undefined}
                                            placeholder={t('filterByDateFrom')}
                                            displayFormat="dd/MM/yyyy"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-foreground-muted flex items-center gap-1.5">
                                            <CalendarDays className="h-3.5 w-3.5" />
                                            {t('filterByDateTo')}
                                        </Label>
                                        <DatePicker
                                            value={dateTo}
                                            onChange={setDateTo}
                                            min={dateFrom || undefined}
                                            placeholder={t('filterByDateTo')}
                                            displayFormat="dd/MM/yyyy"
                                        />
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>

                        {/* Clear advanced filters inline */}
                        {activeAdvancedFilterCount > 0 && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
                                onClick={clearAdvancedFilters}
                            >
                                <X className="h-4 w-4" />
                                <span className="sr-only">{t('clearFilters')}</span>
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Comments list — scrollable area */}
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1">
                {isLoading ? (
                    <div className="space-y-4 py-1 animate-pulse">
                        {/* Skeleton comment 1 — long content */}
                        <div className="flex items-start gap-2.5">
                            <div className="h-6 w-6 rounded-full bg-foreground-muted/10 shrink-0" />
                            <div className="flex-1 min-w-0 space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-24 rounded bg-foreground-muted/10" />
                                    <div className="h-2.5 w-14 rounded bg-foreground-muted/[0.06]" />
                                </div>
                                <div className="space-y-1">
                                    <div className="h-2.5 w-full rounded bg-foreground-muted/[0.07]" />
                                    <div className="h-2.5 w-3/4 rounded bg-foreground-muted/[0.07]" />
                                </div>
                                <div className="flex items-center gap-2 pt-0.5">
                                    <div className="h-2.5 w-10 rounded bg-foreground-muted/[0.05]" />
                                    <div className="h-2.5 w-16 rounded bg-foreground-muted/[0.05]" />
                                </div>
                            </div>
                        </div>

                        {/* Skeleton comment 2 — with step badge */}
                        <div className="flex items-start gap-2.5">
                            <div className="h-6 w-6 rounded-full bg-foreground-muted/10 shrink-0" />
                            <div className="flex-1 min-w-0 space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-20 rounded bg-foreground-muted/10" />
                                    <div className="h-2.5 w-12 rounded bg-foreground-muted/[0.06]" />
                                </div>
                                <div className="h-4 w-28 rounded bg-purple-500/[0.06]" />
                                <div className="space-y-1">
                                    <div className="h-2.5 w-5/6 rounded bg-foreground-muted/[0.07]" />
                                </div>
                                <div className="flex items-center gap-2 pt-0.5">
                                    <div className="h-2.5 w-10 rounded bg-foreground-muted/[0.05]" />
                                </div>
                            </div>
                        </div>

                        {/* Skeleton comment 3 — short, with nested reply */}
                        <div className="flex items-start gap-2.5">
                            <div className="h-6 w-6 rounded-full bg-foreground-muted/10 shrink-0" />
                            <div className="flex-1 min-w-0 space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-28 rounded bg-foreground-muted/10" />
                                    <div className="h-2.5 w-10 rounded bg-foreground-muted/[0.06]" />
                                </div>
                                <div className="h-2.5 w-2/3 rounded bg-foreground-muted/[0.07]" />
                                <div className="flex items-center gap-2 pt-0.5">
                                    <div className="h-2.5 w-10 rounded bg-foreground-muted/[0.05]" />
                                    <div className="h-2.5 w-20 rounded bg-accent-blue/[0.08]" />
                                </div>
                                {/* Nested reply skeleton */}
                                <div className="ml-8 pl-3 border-l-2 border-border/30 mt-2">
                                    <div className="flex items-start gap-2.5">
                                        <div className="h-4 w-4 rounded-full bg-foreground-muted/10 shrink-0 mt-0.5" />
                                        <div className="flex-1 min-w-0 space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <div className="h-2.5 w-16 rounded bg-foreground-muted/10" />
                                                <div className="h-2 w-10 rounded bg-foreground-muted/[0.06]" />
                                            </div>
                                            <div className="h-2.5 w-1/2 rounded bg-foreground-muted/[0.07]" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Skeleton comment 4 — correction type badge */}
                        <div className="space-y-1">
                            <div className="h-4 w-20 rounded-md bg-amber-500/[0.06]" />
                            <div className="flex items-start gap-2.5">
                                <div className="h-6 w-6 rounded-full bg-foreground-muted/10 shrink-0" />
                                <div className="flex-1 min-w-0 space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className="h-3 w-18 rounded bg-foreground-muted/10" />
                                        <div className="h-2.5 w-16 rounded bg-foreground-muted/[0.06]" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="h-2.5 w-full rounded bg-foreground-muted/[0.07]" />
                                        <div className="h-2.5 w-1/2 rounded bg-foreground-muted/[0.07]" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Skeleton comment 5 — minimal */}
                        <div className="flex items-start gap-2.5">
                            <div className="h-6 w-6 rounded-full bg-foreground-muted/10 shrink-0" />
                            <div className="flex-1 min-w-0 space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-22 rounded bg-foreground-muted/10" />
                                    <div className="h-2.5 w-12 rounded bg-foreground-muted/[0.06]" />
                                </div>
                                <div className="h-2.5 w-4/5 rounded bg-foreground-muted/[0.07]" />
                            </div>
                        </div>
                    </div>
                ) : rootComments.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-foreground-muted">
                        {activeAdvancedFilterCount > 0 || debouncedSearch.trim() || filter !== 'all' ? (
                            <>
                                <Search className="h-5 w-5 text-foreground-muted/30" />
                                <p className="text-sm">{t('noMatchingComments')}</p>
                                <button
                                    onClick={() => {
                                        setSearchInput('');
                                        clearAdvancedFilters();
                                        setFilter('all');
                                    }}
                                    className="text-xs text-accent-blue hover:underline cursor-pointer mt-1"
                                >
                                    {t('clearFilters')}
                                </button>
                            </>
                        ) : (
                            <>
                                <MessageCircle className="h-5 w-5 text-foreground-muted/30" />
                                <p className="text-sm">{t('noComments')}</p>
                            </>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Load previous */}
                        {hasOlderComments && (
                            <div className="flex justify-center pb-2">
                                <button
                                    onClick={loadPreviousMessages}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground hover:bg-foreground/[0.04] rounded-md transition-colors cursor-pointer"
                                >
                                    <ChevronUp className="h-3.5 w-3.5" />
                                    {t('loadPrevious', { count: Math.min(PANEL_PAGE_SIZE, olderCount) })}
                                </button>
                            </div>
                        )}

                        {displayedRoots.map((comment) => {
                            const replies = getReplies(comment.id);
                            const repliesCount = getRepliesCount(comment.id);

                            return (
                                <div
                                    key={comment.id}
                                    id={`comment-float-${comment.id}`}
                                    className={cn(
                                        "transition-colors duration-500 rounded-md",
                                        highlightedCommentId === comment.id && "bg-accent-blue/8 ring-1 ring-accent-blue/20 px-2 py-1",
                                    )}
                                >
                                    <CommentItem
                                        comment={comment}
                                        projectId={projectId}
                                        replies={replies}
                                        repliesCount={repliesCount}
                                        stepsMap={stepsMap}
                                        onOpenThread={() => setActiveThreadId(comment.id)}
                                        onStartEdit={handleStartEdit}
                                        onDelete={handleDelete}
                                        onArchive={handleArchive}
                                        onRestore={handleRestore}
                                        onResolve={handleResolve}
                                        onRemoveAttachment={handleRemoveAttachment}
                                        onToggleReaction={handleToggleReaction}
                                    />
                                </div>
                            );
                        })}
                    </>
                )}
            </div>

            {/* Input — sticky at the bottom */}
            {canComment && (
                <div className="pt-2 mt-2 shrink-0">
                    <CommentInput
                        ref={inputRef}
                        projectId={projectId}
                        onSubmit={handleSubmit}
                        onEditSubmit={handleEditSubmit}
                        isSubmitting={createComment.isPending || updateComment.isPending}
                        showTypeSelector
                        compact
                        editingComment={editingComment}
                        onCancelEdit={handleCancelEdit}
                    />
                </div>
            )}

            {/* Thread drawer — Slack-like thread view */}
            <ThreadPanel
                open={!!activeThreadComment}
                parentComment={activeThreadComment}
                replies={activeThreadReplies}
                projectId={projectId}
                stepsMap={stepsMap}
                canComment={canComment}
                isSubmitting={createComment.isPending}
                isEditSubmitting={updateComment.isPending}
                onSubmitReply={handleThreadReply}
                onEditSubmit={handleEditSubmit}
                onDelete={handleDelete}
                onArchive={handleArchive}
                onRestore={handleRestore}
                onResolve={handleResolve}
                onRemoveAttachment={handleRemoveAttachment}
                onToggleReaction={handleToggleReaction}
                onClose={() => setActiveThreadId(null)}
            />
        </div>
    );
}
