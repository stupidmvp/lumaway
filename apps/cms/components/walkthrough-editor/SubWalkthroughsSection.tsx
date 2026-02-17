'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import {
    useSubWalkthroughs,
    useCreateWalkthrough,
    useUpdateWalkthrough,
    type Walkthrough,
} from '@luma/infra';
import {
    GitPullRequest,
    ChevronDown,
    ChevronRight,
    Plus,
    Settings2,
    Circle,
    CheckCircle2,
    Loader2,
    Unlink,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

interface SubWalkthroughsSectionProps {
    walkthroughId: string;
    projectId: string;
    canEdit: boolean;
}

export const SubWalkthroughsSection = React.memo(function SubWalkthroughsSection({
    walkthroughId,
    projectId,
    canEdit,
}: SubWalkthroughsSectionProps) {
    const t = useTranslations('SubWalkthroughs');
    const { data: subWalkthroughsData, isLoading } = useSubWalkthroughs(walkthroughId);
    const createMutation = useCreateWalkthrough();
    const updateMutation = useUpdateWalkthrough();

    const [isExpanded, setIsExpanded] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newTitle, setNewTitle] = useState('');

    // Normalize sub-walkthroughs data (could be paginated or plain array)
    const subWalkthroughs: Walkthrough[] = Array.isArray(subWalkthroughsData)
        ? subWalkthroughsData
        : (subWalkthroughsData as any)?.data ?? [];

    const totalCount = subWalkthroughs.length;
    const publishedCount = subWalkthroughs.filter(w => w.isPublished).length;

    const handleCreate = useCallback(async () => {
        if (!newTitle.trim()) return;

        try {
            await createMutation.mutateAsync({
                projectId,
                parentId: walkthroughId,
                title: newTitle.trim(),
                steps: [],
            });
            setNewTitle('');
            setIsCreating(false);
            toast.success(t('created'));
        } catch {
            toast.error(t('createFailed'));
        }
    }, [newTitle, projectId, walkthroughId, createMutation, t]);

    const handleUnlink = useCallback(async (child: Walkthrough) => {
        try {
            await updateMutation.mutateAsync({
                id: child.id,
                data: { parentId: null },
            });
            toast.success(t('unlinked'));
        } catch {
            toast.error(t('unlinkFailed'));
        }
    }, [updateMutation, t]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleCreate();
        }
        if (e.key === 'Escape') {
            setIsCreating(false);
            setNewTitle('');
        }
    }, [handleCreate]);

    // Show the section only if there are children or user can edit
    if (!canEdit && totalCount === 0) return null;

    return (
        <div className="mb-3">
            {/* Header with expand/collapse, count, and actions */}
            {totalCount > 0 ? (
                <div className="flex items-center justify-between mb-2">
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors cursor-pointer"
                    >
                        {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-foreground-muted" />
                        ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-foreground-muted" />
                        )}
                        <span>{t('title')}</span>

                        {/* Progress indicator */}
                        <span className="ml-1.5 flex items-center gap-1">
                            <svg className="h-4 w-4" viewBox="0 0 20 20">
                                <circle
                                    cx="10"
                                    cy="10"
                                    r="8"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    className="text-border"
                                />
                                {totalCount > 0 && (
                                    <circle
                                        cx="10"
                                        cy="10"
                                        r="8"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeDasharray={`${(publishedCount / totalCount) * 50.27} 50.27`}
                                        strokeLinecap="round"
                                        transform="rotate(-90 10 10)"
                                        className="text-accent-blue"
                                    />
                                )}
                            </svg>
                            <span className="text-xs text-foreground-muted">
                                {publishedCount}/{totalCount}
                            </span>
                        </span>
                    </button>

                    {canEdit && (
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsExpanded(true);
                                    setIsCreating(true);
                                }}
                                className="p-1 rounded-md text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors cursor-pointer"
                                title={t('addSubWalkthrough')}
                            >
                                <Plus className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                /* Empty state — just "+ Add sub-walkthroughs" */
                canEdit && !isCreating && (
                    <button
                        type="button"
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground transition-colors cursor-pointer py-1"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{t('addSubWalkthroughs')}</span>
                    </button>
                )
            )}

            {/* Sub-walkthroughs list */}
            {isExpanded && totalCount > 0 && (
                <div className="space-y-0.5 mt-1">
                    {subWalkthroughs.map((child) => (
                        <div
                            key={child.id}
                            className="group flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-md hover:bg-background-secondary/50 transition-colors"
                        >
                            <div className="relative shrink-0">
                                <GitPullRequest className="h-4 w-4 text-foreground-muted/60" />
                                <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background ${child.isPublished ? 'bg-green-500' : 'bg-amber-500'}`} />
                            </div>

                            <Link
                                href={`/walkthroughs/${child.id}`}
                                className="flex-1 text-sm text-foreground hover:text-accent-blue truncate transition-colors"
                            >
                                {child.title}
                            </Link>

                            {canEdit && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            type="button"
                                            className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-foreground-muted hover:text-foreground transition-all cursor-pointer"
                                        >
                                            <Settings2 className="h-3.5 w-3.5" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-44">
                                        <DropdownMenuItem
                                            onClick={() => handleUnlink(child)}
                                            className="text-xs"
                                        >
                                            <Unlink className="h-3.5 w-3.5 mr-2" />
                                            {t('removeFromParent')}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Inline creation form */}
            {isCreating && (
                <div className="flex items-center gap-2 mt-2 pl-1">
                    <Circle className="h-4 w-4 text-foreground-muted/40 shrink-0" />
                    <Input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={t('titlePlaceholder')}
                        className="h-8 text-sm flex-1"
                        autoFocus
                        disabled={createMutation.isPending}
                    />
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            setIsCreating(false);
                            setNewTitle('');
                        }}
                        disabled={createMutation.isPending}
                        className="h-8 px-2"
                    >
                        {t('cancel')}
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleCreate}
                        disabled={!newTitle.trim() || createMutation.isPending}
                        className="h-8 px-3"
                    >
                        {createMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            t('create')
                        )}
                    </Button>
                </div>
            )}

            {/* Loading state */}
            {isLoading && (
                <div className="flex items-center gap-2 py-2 text-foreground-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span className="text-xs">{t('loading')}</span>
                </div>
            )}
        </div>
    );
});

