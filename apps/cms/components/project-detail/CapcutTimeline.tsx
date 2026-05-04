'use client';

import { useRef, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface VideoTextSegment {
    id: string;
    order: number;
    startMs: number;
    endMs: number;
    text: string;
}

interface CapcutTimelineProps {
    durationSec: number;
    currentTimeSec: number;
    segments: VideoTextSegment[];
    selectedSegmentId: string | null;
    onSeek: (sec: number) => void;
    onUpdateSegment: (id: string, patch: Partial<VideoTextSegment>) => void;
    onSelectSegment: (id: string) => void;
    videoRef: React.RefObject<HTMLVideoElement | null>;
}

function formatVideoTime(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${ms}`;
}

export function CapcutTimeline({
    durationSec,
    currentTimeSec,
    segments,
    selectedSegmentId,
    onSeek,
    onUpdateSegment,
    onSelectSegment,
    videoRef,
}: CapcutTimelineProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const playheadRef = useRef<HTMLDivElement>(null);

    const safeDuration = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0;
    const pixelsPerSecond = 50; // New scale for verification
    const timelineWidth = Math.max(800, safeDuration * pixelsPerSecond);

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
                const x = video.currentTime * pixelsPerSecond;
                playhead.style.transform = `translate3d(${x}px, 0, 0)`;
                
                if (container) {
                    const now = Date.now();
                    const isManualScrolling = now - lastManualScrollTime.current < 5000;
                    
                    if (!isManualScrolling) {
                        const scrollLeft = container.scrollLeft;
                        const containerWidth = container.clientWidth;
                        const padding = 100; // More lenient padding
                        
                        // Only auto-scroll if playhead is really near the edges
                        const isNearRightEdge = x > (scrollLeft + containerWidth - padding);
                        const isNearLeftEdge = x < (scrollLeft + padding);
                        
                        if (isNearRightEdge || isNearLeftEdge) {
                            // Smoothly center the playhead
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
    }, [videoRef, pixelsPerSecond, timelineWidth]);

    const handleTrackClick = (e: React.MouseEvent) => {
        if (!safeDuration || !trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const seekSec = x / pixelsPerSecond;
        onSeek(Math.max(0, Math.min(safeDuration, seekSec)));
    };

    const handleSegmentMove = (segment: VideoTextSegment) => (e: React.PointerEvent) => {
        e.stopPropagation();
        const startX = e.clientX;
        const initialStartMs = segment.startMs;
        const initialEndMs = segment.endMs;
        const durationMs = initialEndMs - initialStartMs;
        
        const handlePointerMove = (moveEvent: PointerEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaMs = (deltaX / pixelsPerSecond) * 1000;
            
            let newStartMs = initialStartMs + deltaMs;
            let newEndMs = initialEndMs + deltaMs;

            // Constrain to timeline bounds
            if (newStartMs < 0) {
                newStartMs = 0;
                newEndMs = durationMs;
            }
            if (newEndMs > safeDuration * 1000) {
                newEndMs = safeDuration * 1000;
                newStartMs = newEndMs - durationMs;
            }
            
            onUpdateSegment(segment.id, { 
                startMs: Math.round(newStartMs), 
                endMs: Math.round(newEndMs) 
            });
        };

        const handlePointerUp = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            document.body.style.cursor = 'default';
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        document.body.style.cursor = 'grabbing';
    };

    const handleSegmentResize = (segment: VideoTextSegment, type: 'start' | 'end') => (e: React.PointerEvent) => {
        e.stopPropagation();
        const startX = e.clientX;
        const startValueMs = type === 'start' ? segment.startMs : segment.endMs;
        
        const handlePointerMove = (moveEvent: PointerEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaMs = (deltaX / pixelsPerSecond) * 1000;
            const newValueMs = Math.max(0, Math.min(safeDuration * 1000, startValueMs + deltaMs));
            
            if (type === 'start') {
                if (newValueMs < segment.endMs - 100) {
                    onUpdateSegment(segment.id, { startMs: Math.round(newValueMs) });
                }
            } else {
                if (newValueMs > segment.startMs + 100) {
                    onUpdateSegment(segment.id, { endMs: Math.round(newValueMs) });
                }
            }
        };

        const handlePointerUp = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
    };

    const ticks = useMemo(() => {
        if (safeDuration <= 0) return [];
        const interval = 1; 
        const count = Math.min(Math.floor(safeDuration / interval), 3000); 
        return Array.from({ length: count + 1 }).map((_, i) => ({
            sec: i * interval,
            x: i * interval * pixelsPerSecond,
            isMajor: i % 5 === 0
        }));
    }, [safeDuration, pixelsPerSecond]);

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] rounded-md overflow-hidden border border-white/5 select-none">
            <div className="bg-[#141414] h-8 flex items-center px-4 border-b border-white/5 justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Timeline</span>
                </div>
                <span className="text-[10px] font-mono text-white/60 tabular-nums bg-white/5 px-2 py-0.5 rounded">
                    {formatVideoTime(currentTimeSec)} / {formatVideoTime(safeDuration)}
                </span>
            </div>

            <div 
                ref={containerRef}
                className="flex-1 overflow-auto scrollbar-none relative bg-[#0f0f0f]"
                style={{ scrollBehavior: 'auto' }}
                onScroll={handleScroll}
            >
                <div 
                    ref={trackRef}
                    className="relative min-h-full"
                    style={{ width: `${timelineWidth}px` }}
                    onClick={handleTrackClick}
                >
                    {/* Ruler */}
                    <div className="h-8 border-b border-white/10 sticky top-0 bg-[#141414]/95 backdrop-blur-sm z-40">
                        {ticks.map((tick) => (
                            <div 
                                key={tick.sec} 
                                className={cn(
                                    "absolute top-0 h-full border-l flex flex-col justify-end pb-1",
                                    tick.isMajor ? "border-white/30 w-px" : "border-white/10 h-1/3 mt-5"
                                )}
                                style={{ left: `${tick.x}px` }}
                            >
                                {tick.isMajor && (
                                    <span className="text-[9px] text-white/50 -translate-x-1/2 ml-[-1px] mb-0.5 leading-none font-mono">
                                        {formatVideoTime(tick.sec)}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Tracks Container */}
                    <div className="flex flex-col py-4 px-0 relative min-h-[160px]">
                        {/* Subtitle Tracks */}
                        {segments.map((segment) => {
                            const x = (segment.startMs / 1000) * pixelsPerSecond;
                            const width = ((segment.endMs - segment.startMs) / 1000) * pixelsPerSecond;
                            const isSelected = selectedSegmentId === segment.id;
                            const isActive = (currentTimeSec * 1000) >= segment.startMs && (currentTimeSec * 1000) <= segment.endMs;

                            return (
                                <div 
                                    key={segment.id} 
                                    className={cn(
                                        "h-11 relative border-b border-white/[0.02] transition-colors",
                                        isSelected ? "bg-white/[0.06]" : isActive ? "bg-white/[0.03]" : ""
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "absolute h-8 top-1.5 rounded-sm cursor-grab active:cursor-grabbing transition-shadow flex items-center overflow-hidden border-x-[3px]",
                                            isSelected 
                                                ? "bg-[#ff7a00] border-white shadow-[0_0_20px_rgba(255,122,0,0.4)] z-20" 
                                                : isActive
                                                    ? "bg-[#ff7a00] border-white/50 z-15"
                                                    : "bg-[#ff7a00]/40 border-transparent hover:bg-[#ff7a00]/60 z-10"
                                        )}
                                        style={{ left: `${x}px`, width: `${width}px` }}
                                        onPointerDown={handleSegmentMove(segment)}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectSegment(segment.id);
                                        }}
                                    >
                                        <div 
                                            className="absolute left-0 inset-y-0 w-3 cursor-ew-resize hover:bg-white/20 transition-colors z-30"
                                            onPointerDown={handleSegmentResize(segment, 'start')}
                                        />
                                        <div 
                                            className="absolute right-0 inset-y-0 w-3 cursor-ew-resize hover:bg-white/20 transition-colors z-30"
                                            onPointerDown={handleSegmentResize(segment, 'end')}
                                        />
                                        <div className="px-4 text-[11px] font-bold text-white truncate pointer-events-none drop-shadow-md">
                                            {segment.text}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Video Background Tracks Style Capcut */}
                        <div className="h-20 mt-6 relative bg-white/[0.02] border-y border-white/5 flex items-center overflow-hidden">
                             <div className="flex gap-1 h-full opacity-20">
                                {Array.from({ length: Math.min(Math.ceil(timelineWidth / 120), 300) }).map((_, i) => (
                                    <div key={i} className="w-[116px] h-full bg-white/5 shrink-0 border-r border-white/5" />
                                ))}
                             </div>
                        </div>
                    </div>

                    {/* Playhead - Pixel based with Ref for 60fps performance */}
                    <div 
                        ref={playheadRef}
                        className="absolute top-0 bottom-0 left-0 w-[2px] bg-white z-50 pointer-events-none shadow-[0_0_10px_rgba(255,255,255,0.8)] will-change-transform"
                    >
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full border-2 border-[#ff7a00]" />
                    </div>
                </div>
            </div>
        </div>
    );
}
