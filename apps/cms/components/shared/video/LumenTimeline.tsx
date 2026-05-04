'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface TimelineStep {
    id: string;
    timestampMs: number;
}

interface LumenTimelineProps {
    durationSec: number;
    currentTime: number;
    progressPercent: number;
    reviewSteps: TimelineStep[];
    activeStepId: string | null;
    onSeek: (seconds: number) => void;
    onScrub: (seconds: number) => void;
    onSelectStep?: (id: string) => void;
}

export const LumenTimeline: React.FC<LumenTimelineProps> = ({
    durationSec,
    currentTime,
    progressPercent,
    reviewSteps,
    activeStepId,
    onSeek,
    onScrub,
    onSelectStep,
}) => {
    return (
        <div className="relative w-full h-1.5 transition-all duration-200 z-50 group/timeline cursor-pointer overflow-visible bg-black/40 backdrop-blur-sm border-t border-white/10">
            {/* Progress Fill (Absolute Edge-to-Edge) */}
            <div 
                className="absolute inset-y-0 left-0 bg-red-600 transition-all duration-75 z-10 shadow-[0_0_15px_rgba(220,38,38,0.8)]"
                style={{ width: `${progressPercent}%`, minWidth: progressPercent > 0.1 ? '2px' : '0' }}
            />

            {/* Key Points (Review Steps) */}
            {reviewSteps.map((step) => {
                let stepSec = step.timestampMs;
                if (stepSec > durationSec && stepSec > 1000) {
                    stepSec = stepSec / 1000;
                }
                const safeDuration = durationSec || 1;
                const left = Math.min(100, Math.max(0, (stepSec / safeDuration) * 100));
                const isActive = activeStepId === step.id || Math.abs(stepSec - currentTime) < 0.75;
                
                return (
                    <button
                        key={step.id}
                        type="button"
                        className={cn(
                            "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 transition-all duration-200 rounded-full",
                            isActive 
                                ? "h-3.5 w-3.5 bg-amber-400 border border-white shadow-[0_0_8px_rgba(245,158,11,0.6)] scale-110" 
                                : "h-2 w-2 bg-white border border-black/10 hover:h-3 hover:w-3 hover:bg-amber-300"
                        )}
                        style={{ left: `${left}%` }}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectStep) onSelectStep(step.id);
                        }}
                    />
                );
            })}

            {/* Interactive Range Input (Oversized hit area) */}
            <input
                type="range"
                min={0}
                max={durationSec || 100}
                step={0.01}
                value={currentTime}
                onChange={(event) => onScrub(Number(event.currentTarget.value))}
                className="absolute -top-3 -bottom-3 inset-x-0 z-20 w-full cursor-pointer opacity-0 m-0 p-0 appearance-none"
            />
        </div>
    );
};
