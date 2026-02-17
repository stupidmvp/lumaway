'use client';

import { useMemo, useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { CommentReactionSummary } from '@luma/infra';

// Curated set of common reaction emojis (Slack-style)
const REACTION_EMOJIS = [
    '👍', '👎', '❤️', '😄', '😮', '🎉', '🤔', '👀', '🚀', '✅',
    '💯', '👏', '🔥', '💡', '⭐',
];

interface GroupedReaction {
    emoji: string;
    count: number;
    users: { id: string; name: string }[];
    currentUserReacted: boolean;
}

interface CommentReactionsProps {
    reactions: CommentReactionSummary[];
    currentUserId?: string;
    onToggleReaction: (emoji: string) => void;
    disabled?: boolean;
    /** When true, hides the inline "add reaction" button (useful when the trigger lives elsewhere) */
    hideAddButton?: boolean;
}

export function CommentReactions({
    reactions,
    currentUserId,
    onToggleReaction,
    disabled = false,
    hideAddButton = false,
}: CommentReactionsProps) {
    const t = useTranslations('Comments');
    const [pickerOpen, setPickerOpen] = useState(false);

    // Group reactions by emoji
    const grouped = useMemo<GroupedReaction[]>(() => {
        const map = new Map<string, GroupedReaction>();

        for (const r of reactions) {
            const existing = map.get(r.emoji);
            const userName = r.user
                ? `${r.user.firstName} ${r.user.lastName}`.trim()
                : 'Unknown';

            if (existing) {
                existing.count++;
                existing.users.push({ id: r.userId, name: userName });
                if (r.userId === currentUserId) {
                    existing.currentUserReacted = true;
                }
            } else {
                map.set(r.emoji, {
                    emoji: r.emoji,
                    count: 1,
                    users: [{ id: r.userId, name: userName }],
                    currentUserReacted: r.userId === currentUserId,
                });
            }
        }

        return Array.from(map.values());
    }, [reactions, currentUserId]);

    const handlePickerSelect = (emoji: string) => {
        onToggleReaction(emoji);
        setPickerOpen(false);
    };

    return (
        <div className="flex items-center gap-1 flex-wrap">
            {/* Existing reaction pills */}
            <TooltipProvider delayDuration={300}>
                {grouped.map((group) => {
                    const tooltipNames = group.users.map((u) =>
                        u.id === currentUserId ? t('youReacted') : u.name
                    ).join(', ');

                    return (
                        <Tooltip key={group.emoji}>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => onToggleReaction(group.emoji)}
                                    disabled={disabled}
                                    className={cn(
                                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] border transition-all cursor-pointer select-none",
                                        group.currentUserReacted
                                            ? "bg-accent-blue/10 border-accent-blue/30 text-accent-blue hover:bg-accent-blue/20"
                                            : "bg-foreground/[0.04] border-border/50 text-foreground-muted hover:bg-foreground/[0.08] hover:border-border",
                                        disabled && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    <span className="text-xs leading-none">{group.emoji}</span>
                                    <span className="font-medium tabular-nums">{group.count}</span>
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs max-w-[200px]">
                                {tooltipNames}
                            </TooltipContent>
                        </Tooltip>
                    );
                })}
            </TooltipProvider>

            {/* Add reaction button (emoji picker trigger) */}
            {!disabled && !hideAddButton && (
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                    <PopoverTrigger asChild>
                        <button
                            className={cn(
                                "inline-flex items-center justify-center h-6 w-6 rounded-full border border-transparent transition-all cursor-pointer",
                                "text-foreground-muted/40 hover:text-foreground-muted hover:bg-foreground/[0.06] hover:border-border/50",
                                reactions.length === 0 && "opacity-0 group-hover:opacity-100"
                            )}
                            title={t('addReaction')}
                        >
                            <SmilePlus className="h-3.5 w-3.5" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="start"
                        side="top"
                        sideOffset={4}
                        className="w-auto p-2"
                    >
                        <div className="grid grid-cols-5 gap-1">
                            {REACTION_EMOJIS.map((emoji) => {
                                const alreadyReacted = grouped.some(
                                    (g) => g.emoji === emoji && g.currentUserReacted
                                );

                                return (
                                    <button
                                        key={emoji}
                                        onClick={() => handlePickerSelect(emoji)}
                                        className={cn(
                                            "flex items-center justify-center w-8 h-8 rounded-md text-base transition-colors cursor-pointer",
                                            alreadyReacted
                                                ? "bg-accent-blue/10 ring-1 ring-accent-blue/30"
                                                : "hover:bg-foreground/[0.08]"
                                        )}
                                    >
                                        {emoji}
                                    </button>
                                );
                            })}
                        </div>
                    </PopoverContent>
                </Popover>
            )}
        </div>
    );
}

