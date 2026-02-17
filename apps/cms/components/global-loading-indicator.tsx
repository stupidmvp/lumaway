'use client';

import { useIsMutating } from '@tanstack/react-query';

/**
 * Thin animated progress bar displayed at the very top of the viewport
 * whenever any React Query mutation (POST / PATCH / DELETE) is in flight.
 *
 * Placed once in the dashboard layout — no per-page wiring needed.
 */
export function GlobalLoadingIndicator() {
    const isMutating = useIsMutating();

    if (isMutating === 0) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] h-0.5 overflow-hidden bg-accent-blue/20">
            <div className="h-full w-1/3 bg-accent-blue rounded-full animate-progress-bar" />
        </div>
    );
}

