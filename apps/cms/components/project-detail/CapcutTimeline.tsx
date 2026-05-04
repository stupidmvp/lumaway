'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface VideoTextSegment {
    id: string;
    order: number;
    startMs: number;
    endMs: number;
    text: string;
    title?: string;
    description?: string;
}

interface CapcutTimelineProps {
    durationSec: number;
    currentTimeSec: number;
    subtitleSegments: VideoTextSegment[];
    selectedSubtitleId: string | null;
    stepSegments: VideoTextSegment[];
    selectedStepId: string | null;
    onSeek: (sec: number) => void;
    onUpdateSubtitle: (id: string, patch: Partial<VideoTextSegment>) => void;
    onUpdateStep: (id: string, patch: Partial<VideoTextSegment>) => void;
    onUpdateEnd?: (type: 'subtitle' | 'step', id: string) => void;
    onSelectSubtitle: (id: string) => void;
    onSelectStep: (id: string) => void;
    onSegmentClickStep?: (id: string) => void;
    onSegmentClickSubtitle?: (id: string) => void;
    videoRef: React.RefObject<HTMLVideoElement | null>;
}

function formatVideoTime(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00.0';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${ms}`;
}

export function CapcutTimeline({
    durationSec,
    currentTimeSec,
    subtitleSegments,
    selectedSubtitleId,
    stepSegments,
    selectedStepId,
    onSeek,
    onUpdateSubtitle,
    onUpdateStep,
    onUpdateEnd,
    onSelectSubtitle,
    onSelectStep,
    onSegmentClickStep,
    onSegmentClickSubtitle,
    videoRef,
}: CapcutTimelineProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const playheadRef = useRef<HTMLDivElement>(null);
    const [zoomLevel] = useState(50); // pixels per second

    const safeDuration = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0;
    const timelineWidth = Math.max(800, safeDuration * zoomLevel);

    const lastManualScrollTime = useRef(0);

    const handleScroll = () => {
        lastManualScrollTime.current = Date.now();
    };

    // Hardware-accelerated sync loop
    useEffect(() => {
        let frameId: number;
        const sync = () => {
            const container = containerRef.current;
            const playhead = playheadRef.current;
            const video = videoRef.current;

            if (video && playhead) {
                const x = video.currentTime * zoomLevel;
                playhead.style.transform = `translate3d(${x}px, 0, 0)`;
                
                if (container) {
                    const now = Date.now();
                    const isManualScrolling = now - lastManualScrollTime.current < 5000;
                    
                    if (!isManualScrolling) {
                        const scrollLeft = container.scrollLeft;
                        const containerWidth = container.clientWidth;
                        const padding = 150;
                        
                        const isNearRightEdge = x > (scrollLeft + containerWidth - padding);
                        const isNearLeftEdge = x < (scrollLeft + padding);
                        
                        if (isNearRightEdge || isNearLeftEdge) {
                            const targetScroll = x - (containerWidth / 2);
                            container.scrollTo({
                                left: Math.max(0, targetScroll),
                                behavior: 'smooth'
                            });
                        }
                    }
                }
            }
            frameId = requestAnimationFrame(sync);
        };
        frameId = requestAnimationFrame(sync);
        return () => cancelAnimationFrame(frameId);
    }, [videoRef, zoomLevel]);

    const handleTrackClick = (e: React.MouseEvent) => {
        if (!safeDuration || !trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const seekSec = x / zoomLevel;
        onSeek(Math.max(0, Math.min(safeDuration, seekSec)));
    };

    const handleSegmentMouseDown = (
        e: React.MouseEvent, 
        type: 'subtitle' | 'step', 
        segment: VideoTextSegment, 
        action: 'move' | 'resize-left' | 'resize-right'
    ) => {
        e.stopPropagation();
        const startX = e.clientX;
        const initialStartMs = segment.startMs;
        const initialEndMs = segment.endMs;
        const durationMs = initialEndMs - initialStartMs;
        
        const onUpdate = type === 'subtitle' ? onUpdateSubtitle : onUpdateStep;
        const onSelect = type === 'subtitle' ? onSelectSubtitle : onSelectStep;

        onSelect(segment.id);

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaMs = (deltaX / zoomLevel) * 1000;
            
            if (action === 'move') {
                let newStartMs = initialStartMs + deltaMs;
                let newEndMs = initialEndMs + deltaMs;
                if (newStartMs < 0) {
                    newStartMs = 0;
                    newEndMs = durationMs;
                }
                if (newEndMs > safeDuration * 1000) {
                    newEndMs = safeDuration * 1000;
                    newStartMs = newEndMs - durationMs;
                }
                onUpdate(segment.id, { startMs: Math.round(newStartMs), endMs: Math.round(newEndMs) });
            } else if (action === 'resize-left') {
                const newStartMs = Math.max(0, Math.min(initialEndMs - 100, initialStartMs + deltaMs));
                onUpdate(segment.id, { startMs: Math.round(newStartMs) });
            } else if (action === 'resize-right') {
                const newEndMs = Math.max(initialStartMs + 100, Math.min(safeDuration * 1000, initialEndMs + deltaMs));
                onUpdate(segment.id, { endMs: Math.round(newEndMs) });
            }
        };

        const handlePointerUp = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            document.body.style.cursor = 'default';
            if (onUpdateEnd) onUpdateEnd(type, segment.id);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        document.body.style.cursor = action === 'move' ? 'grabbing' : 'ew-resize';
    };

    const ticks = useMemo(() => {
        if (safeDuration <= 0) return [];
        const interval = 1; 
        const count = Math.min(Math.floor(safeDuration / interval), 3000); 
        return Array.from({ length: count + 1 }).map((_, i) => ({
            sec: i * interval,
            x: i * interval * zoomLevel,
            isMajor: i % 5 === 0
        }));
    }, [safeDuration, zoomLevel]);

    return (
        <div className="flex flex-col bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
            {/* Header / Ruler Controls */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#0a0a0a] border-b border-white/5 z-50">
                <div className="flex items-center gap-3">
                    <div className="px-2 py-0.5 rounded bg-white/5 border border-white/10">
                        <span className="text-[11px] font-mono font-bold text-accent-blue">
                            {formatVideoTime(currentTimeSec)}
                        </span>
                    </div>
                    <span className="text-[10px] text-white/30 font-medium">
                        / {formatVideoTime(safeDuration)}
                    </span>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                        <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Subtitles</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                        <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Steps</span>
                    </div>
                </div>
            </div>

            <div 
                ref={containerRef}
                className="flex-1 overflow-auto scrollbar-none relative bg-[#0f0f0f]"
                onScroll={handleScroll}
            >
                <div 
                    ref={trackRef}
                    className="relative min-h-[220px]"
                    style={{ width: `${timelineWidth}px` }}
                    onClick={handleTrackClick}
                >
                    {/* Ruler */}
                    <div className="h-8 border-b border-white/5 sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-md z-40">
                        {ticks.map((tick) => (
                            <div 
                                key={tick.sec} 
                                className={cn(
                                    "absolute top-0 h-full border-l transition-opacity",
                                    tick.isMajor ? "border-white/20 w-px" : "border-white/5 h-1/3 mt-5"
                                )}
                                style={{ left: `${tick.x}px` }}
                            >
                                {tick.isMajor && (
                                    <span className="text-[9px] text-white/40 -translate-x-1/2 ml-[-1px] mb-0.5 leading-none font-mono">
                                        {formatVideoTime(tick.sec)}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-1 py-6">
                        {/* Subtitle Track */}
                        <div className="relative h-12 bg-white/[0.02] border-y border-white/[0.03]">
                            {subtitleSegments.map((seg) => {
                                const x = (seg.startMs / 1000) * zoomLevel;
                                const width = ((seg.endMs - seg.startMs) / 1000) * zoomLevel;
                                const isSelected = selectedSubtitleId === seg.id;
                                const isActive = (currentTimeSec * 1000) >= seg.startMs && (currentTimeSec * 1000) <= seg.endMs;

                                return (
                                    <div
                                        key={seg.id}
                                        className={cn(
                                            "absolute h-8 top-2 rounded-md cursor-grab active:cursor-grabbing transition-all flex items-center overflow-hidden border",
                                            isSelected 
                                                ? "bg-slate-700 border-white shadow-[0_0_15px_rgba(255,255,255,0.2)] z-30" 
                                                : isActive
                                                    ? "bg-slate-800 border-white/50 z-20"
                                                    : "bg-slate-900/60 border-white/10 hover:bg-slate-800/80 z-10"
                                        )}
                                        style={{ left: `${x}px`, width: `${width}px` }}
                                        onMouseDown={(e) => handleSegmentMouseDown(e, 'subtitle', seg, 'move')}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (onSegmentClickSubtitle) onSegmentClickSubtitle(seg.id);
                                        }}
                                    >
                                        <div className="px-3 text-[10px] font-medium text-white/90 truncate pointer-events-none">
                                            {seg.text}
                                        </div>
                                        <div 
                                            className="absolute left-0 inset-y-0 w-2 cursor-ew-resize hover:bg-white/20 z-40"
                                            onMouseDown={(e) => handleSegmentMouseDown(e, 'subtitle', seg, 'resize-left')}
                                        />
                                        <div 
                                            className="absolute right-0 inset-y-0 w-2 cursor-ew-resize hover:bg-white/20 z-40"
                                            onMouseDown={(e) => handleSegmentMouseDown(e, 'subtitle', seg, 'resize-right')}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        {/* Steps Track */}
                        <div className="relative h-14 bg-amber-500/[0.02] border-y border-amber-500/5 mt-4">
                            {stepSegments.map((seg) => {
                                const x = (seg.startMs / 1000) * zoomLevel;
                                const width = ((seg.endMs - seg.startMs) / 1000) * zoomLevel;
                                const isSelected = selectedStepId === seg.id;
                                const isActive = (currentTimeSec * 1000) >= seg.startMs && (currentTimeSec * 1000) <= seg.endMs;

                                return (
                                    <div
                                        key={seg.id}
                                        className={cn(
                                            "absolute h-10 top-2 rounded-lg cursor-grab active:cursor-grabbing transition-all flex flex-col justify-center px-3 overflow-hidden border-2",
                                            isSelected 
                                                ? "bg-amber-500 text-black border-white shadow-[0_0_20px_rgba(245,158,11,0.4)] z-30" 
                                                : isActive
                                                    ? "bg-amber-500/80 text-black border-amber-400 z-20"
                                                    : "bg-amber-500/20 text-amber-200/70 border-amber-500/20 hover:bg-amber-500/30 z-10"
                                        )}
                                        style={{ left: `${x}px`, width: `${width}px` }}
                                        onMouseDown={(e) => handleSegmentMouseDown(e, 'step', seg, 'move')}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (onSegmentClickStep) onSegmentClickStep(seg.id);
                                        }}
                                    >
                                        <div className="text-[10px] font-bold truncate pointer-events-none uppercase tracking-tight leading-none">
                                            {seg.title || `Step ${seg.order}`}
                                        </div>
                                        <div className="text-[9px] opacity-70 truncate pointer-events-none italic mt-0.5">
                                            {seg.description}
                                        </div>
                                        <div 
                                            className="absolute left-0 inset-y-0 w-2 cursor-ew-resize hover:bg-white/20 z-40"
                                            onMouseDown={(e) => handleSegmentMouseDown(e, 'step', seg, 'resize-left')}
                                        />
                                        <div 
                                            className="absolute right-0 inset-y-0 w-2 cursor-ew-resize hover:bg-white/20 z-40"
                                            onMouseDown={(e) => handleSegmentMouseDown(e, 'step', seg, 'resize-right')}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Playhead */}
                    <div 
                        ref={playheadRef}
                        className="absolute top-0 bottom-0 left-0 w-[2px] bg-white z-50 pointer-events-none shadow-[0_0_15px_rgba(255,255,255,0.5)] will-change-transform"
                    >
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full border-2 border-accent-blue" />
                    </div>
                </div>
            </div>
        </div>
    );
}
