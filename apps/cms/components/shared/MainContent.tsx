'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MainContentProps {
    children: ReactNode;
    className?: string;
    maxWidth?: string;
    padding?: string;
    /**
     * When true, the content area uses a flex-column layout that fills
     * available space (for panels that manage their own scroll, like CommentsPanel).
     */
    fill?: boolean;
}

export function MainContent({
    children,
    className,
    maxWidth = "max-w-6xl",
    padding = "py-6 px-5 sm:px-6",
    fill = false,
}: MainContentProps) {
    return (
        <main
            className={cn(
                "flex-1 min-h-0 bg-background-secondary dark:bg-background",
                fill ? "flex flex-col overflow-hidden" : "overflow-y-auto",
                padding,
                className,
            )}
        >
            <div className={cn(
                "mx-auto w-full",
                maxWidth,
                fill && "flex-1 min-h-0 flex flex-col",
            )}>
                {children}
            </div>
        </main>
    );
}
