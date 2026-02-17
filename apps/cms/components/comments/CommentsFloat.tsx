'use client';

import { useState, useEffect } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { useProjectComments, useAllWalkthroughComments } from '@luma/infra';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { CommentsPanel } from './CommentsPanel';
import type { WalkthroughStepInfo } from './CommentsPanel';

export type { WalkthroughStepInfo };

export interface CommentsFloatProps {
    projectId: string;
    walkthroughId?: string;
    /** Current step ID — used to auto-tag new comments */
    stepId?: string;
    /** Steps data for showing step labels on comments */
    steps?: WalkthroughStepInfo[];
    /** When false, the comment input is hidden (viewer cannot comment per project settings) */
    canComment?: boolean;
}

export function CommentsFloat({ projectId, walkthroughId, stepId, steps, canComment = true }: CommentsFloatProps) {
    const [isOpen, setIsOpen] = useState(false);
    const searchParams = useSearchParams();

    // Fetch comment count for badge
    const projectCommentsQuery = useProjectComments(
        !walkthroughId ? projectId : undefined,
        { limit: 0 }
    );
    const walkthroughCommentsQuery = useAllWalkthroughComments(
        walkthroughId ? projectId : undefined,
        walkthroughId || undefined
    );
    const commentsCount = walkthroughId
        ? (walkthroughCommentsQuery.data?.total || 0)
        : (projectCommentsQuery.data?.total || 0);

    // Auto-open when navigated from notification
    useEffect(() => {
        if (searchParams.get('tab') === 'activity' || searchParams.get('comments') === 'open') {
            setIsOpen(true);
        }
    }, [searchParams]);

    return (
        <>
            {/* Floating chat window */}
            <div
                className={cn(
                    "fixed bottom-20 right-5 z-50 w-[380px] h-[540px] max-h-[calc(100vh-120px)]",
                    "bg-background border border-border rounded-2xl shadow-2xl",
                    "flex flex-col overflow-hidden",
                    "transition-all duration-200 ease-out origin-bottom-right",
                    isOpen
                        ? "scale-100 opacity-100 pointer-events-auto"
                        : "scale-95 opacity-0 pointer-events-none"
                )}
            >
                <CommentsPanel
                    projectId={projectId}
                    walkthroughId={walkthroughId}
                    stepId={stepId}
                    steps={steps}
                    onClose={() => setIsOpen(false)}
                    canComment={canComment}
                />
            </div>

            {/* Floating Action Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "fixed bottom-5 right-5 z-50",
                    "h-12 w-12 rounded-full shadow-lg",
                    "flex items-center justify-center",
                    "transition-all duration-200 cursor-pointer",
                    "hover:scale-105 active:scale-95",
                    isOpen
                        ? "bg-foreground text-background hover:bg-foreground/90"
                        : "bg-accent-blue text-white hover:bg-accent-blue/90"
                )}
            >
                {isOpen ? (
                    <X className="h-5 w-5" />
                ) : (
                    <MessageCircle className="h-5 w-5" />
                )}

                {/* Unread badge */}
                {!isOpen && commentsCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                        {commentsCount > 99 ? '99+' : commentsCount}
                    </span>
                )}
            </button>
        </>
    );
}

