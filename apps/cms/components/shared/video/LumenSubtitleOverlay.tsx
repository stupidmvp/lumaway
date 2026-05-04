'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface Word {
    text: string;
    startMs: number;
    endMs: number;
}

interface LumenSubtitleOverlayProps {
    currentTime: number; // in seconds
    activeSegment: {
        text: string;
        startMs: number;
        endMs: number;
        words?: Word[];
    } | null;
    align?: 'left' | 'center';
}

export const LumenSubtitleOverlay: React.FC<LumenSubtitleOverlayProps> = ({
    currentTime,
    activeSegment,
    align = 'center'
}) => {
    const activeWords = useMemo(() => {
        if (!activeSegment) return [];

        const currentMs = currentTime * 1000;

        // If we have precise word timestamps, use them
        if (activeSegment.words && activeSegment.words.length > 0) {
            return activeSegment.words
                .filter(w => currentMs >= w.startMs)
                .map((w) => ({
                    text: w.text,
                    active: true
                }));
        }

        // Fallback: Progressive simulation based on segment duration
        const words = activeSegment.text.split(/\s+/).filter(Boolean);
        const duration = Math.max(1, activeSegment.endMs - activeSegment.startMs);
        const elapsed = Math.min(duration, Math.max(0, currentMs - activeSegment.startMs));
        const activeWordCount = Math.min(words.length, Math.max(1, Math.ceil((elapsed / duration) * words.length)));
        
        return words.slice(0, activeWordCount).map((word) => ({
            text: word,
            active: true
        }));
    }, [activeSegment, currentTime]);

    if (!activeSegment || activeWords.length === 0) return null;

    return (
        <div className={cn(
            "absolute bottom-8 flex pointer-events-none z-30 transition-all duration-200 w-full px-6",
            align === 'left' ? "justify-start" : "justify-center"
        )}>
            {/* Square corners (rounded-none) and more transparent background */}
            <div className="bg-black/80 text-white px-3 py-1.5 rounded-none inline-flex flex-wrap gap-x-1.5 gap-y-0.5 text-sm md:text-base font-medium max-w-[85%] shadow-lg animate-in fade-in duration-150">
                {activeWords.map((item, i) => (
                    <span 
                        key={`${activeSegment.startMs}-${i}`} 
                        className="animate-in fade-in duration-100"
                    >
                        {item.text}
                    </span>
                ))}
            </div>
        </div>
    );
};
