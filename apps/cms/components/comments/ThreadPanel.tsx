'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { Comment, CommentType } from '@luma/infra';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import { CommentItem } from './CommentItem';
import { CommentInput } from './CommentInput';
import type { CommentInputHandle, PendingAttachment, EditingComment } from './CommentInput';

export interface ThreadPanelProps {
    /** Whether the drawer is open */
    open: boolean;
    /** The parent (root) comment of this thread */
    parentComment: Comment | null;
    /** All replies to this parent comment */
    replies: Comment[];
    projectId: string;
    /** Map of stepId → { title, index } for step labels */
    stepsMap?: Map<string, { title: string; index: number }>;
    /** Whether the user can write replies */
    canComment?: boolean;
    isSubmitting?: boolean;
    isEditSubmitting?: boolean;
    onSubmitReply: (content: string, type: CommentType, attachments?: PendingAttachment[]) => Promise<void>;
    onEditSubmit: (commentId: string, content: string) => Promise<void>;
    onDelete: (commentId: string) => Promise<void>;
    onArchive: (commentId: string) => Promise<void>;
    onRestore: (commentId: string) => Promise<void>;
    onResolve: (commentId: string) => Promise<void>;
    onRemoveAttachment: (commentId: string, attachmentId: string) => Promise<void>;
    onToggleReaction: (commentId: string, emoji: string) => void;
    onClose: () => void;
}

export function ThreadPanel({
    open,
    parentComment,
    replies,
    projectId,
    stepsMap,
    canComment = true,
    isSubmitting = false,
    isEditSubmitting = false,
    onSubmitReply,
    onEditSubmit,
    onDelete,
    onArchive,
    onRestore,
    onResolve,
    onRemoveAttachment,
    onToggleReaction,
    onClose,
}: ThreadPanelProps) {
    const t = useTranslations('Comments');
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<CommentInputHandle>(null);
    const prevReplyCountRef = useRef(replies.length);
    const [editingComment, setEditingComment] = useState<EditingComment | null>(null);

    const handleStartEdit = useCallback((commentId: string, content: string) => {
        setEditingComment({ id: commentId, content });
    }, []);

    const handleCancelEdit = useCallback(() => {
        setEditingComment(null);
    }, []);

    // Reset editing state when panel closes
    useEffect(() => {
        if (!open) {
            setEditingComment(null);
        }
    }, [open]);

    // Auto-scroll to bottom when new replies come in
    useEffect(() => {
        if (replies.length > prevReplyCountRef.current) {
            setTimeout(() => {
                scrollRef.current?.scrollTo({
                    top: scrollRef.current.scrollHeight,
                    behavior: 'smooth',
                });
            }, 100);
        }
        prevReplyCountRef.current = replies.length;
    }, [replies.length]);

    // Auto-scroll to bottom and focus input when opened
    useEffect(() => {
        if (open && parentComment) {
            setTimeout(() => {
                scrollRef.current?.scrollTo({
                    top: scrollRef.current.scrollHeight,
                });
                inputRef.current?.focus();
            }, 150);
        }
    }, [open, parentComment?.id]);

    const handleSubmit = useCallback(
        async (content: string, type: CommentType, attachments?: PendingAttachment[]) => {
            await onSubmitReply(content, type, attachments);
        },
        [onSubmitReply],
    );

    const userName = parentComment?.user
        ? `${parentComment.user.firstName} ${parentComment.user.lastName}`.trim()
        : '';

    return (
        <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-md p-0 flex flex-col gap-0 [&>button:first-of-type]:hidden"
            >
                {/* Custom header */}
                <SheetHeader className="px-5 py-3 border-b border-border/40 shrink-0 space-y-0">
                    <SheetTitle className="text-sm font-semibold text-foreground">
                        {t('thread')}
                    </SheetTitle>
                    {userName && (
                        <SheetDescription className="text-xs text-foreground-muted mt-0.5">
                            {userName}
                        </SheetDescription>
                    )}
                </SheetHeader>

                {/* Thread content — scrollable */}
                {parentComment && (
                    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-0.5">
                        {/* Parent comment — shown prominently */}
                        <div className="pb-3 border-b border-border/40">
                            <CommentItem
                                comment={parentComment}
                                projectId={projectId}
                                isInThread
                                hideActions
                                stepsMap={stepsMap}
                            />
                        </div>

                        {/* Reply count separator */}
                        {replies.length > 0 && (
                            <div className="flex items-center gap-2 py-2">
                                <div className="flex-1 h-px bg-border/40" />
                                <span className="text-[10px] font-medium text-foreground-muted shrink-0">
                                    {replies.length === 1
                                        ? t('replyCount_one', { count: replies.length })
                                        : t('replyCount_other', { count: replies.length })
                                    }
                                </span>
                                <div className="flex-1 h-px bg-border/40" />
                            </div>
                        )}

                        {/* Replies list */}
                        <div className="space-y-3 pt-1">
                            {replies.map((reply) => (
                                <CommentItem
                                    key={reply.id}
                                    comment={reply}
                                    projectId={projectId}
                                    isNested
                                    isInThread
                                    stepsMap={stepsMap}
                                    onStartEdit={handleStartEdit}
                                    onDelete={onDelete}
                                    onArchive={onArchive}
                                    onRestore={onRestore}
                                    onRemoveAttachment={onRemoveAttachment}
                                    onToggleReaction={onToggleReaction}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Thread reply input */}
                {canComment && parentComment && (
                    <div className="px-5 py-3 border-t border-border/40 shrink-0">
                        <CommentInput
                            ref={inputRef}
                            projectId={projectId}
                            onSubmit={handleSubmit}
                            onEditSubmit={onEditSubmit}
                            isSubmitting={isSubmitting || isEditSubmitting}
                            placeholder={t('writeReply')}
                            compact
                            editingComment={editingComment}
                            onCancelEdit={handleCancelEdit}
                        />
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
