'use client';

import { useRef, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface VideoTextSegment {
    id: string;
    order: number;
    startMs: number;
    endMs: number;
    text: string;
    description?: string;
}

interface CapcutTimelineProps {
    durationSec: number;
    currentTimeSec: number;
    segments: VideoTextSegment[];
    steps?: VideoTextSegment[];
    selectedSegmentId: string | null;
    onSeek: (sec: number) => void;
    onUpdateSegment: (id: string, patch: Partial<VideoTextSegment>) => void;
    onSelectSegment: (id: string) => void;
    onUpdateStep?: (id: string, patch: Partial<VideoTextSegment>) => void;
    onSelectStep?: (id: string) => void;
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
    steps = [],
    selectedSegmentId,
    onSeek,
    onUpdateSegment,
    onSelectSegment,
    onUpdateStep,
    onSelectStep,
    videoRef,
}: CapcutTimelineProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const playheadRef = useRef<HTMLDivElement>(null);

    const safeDuration = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0;
    const pixelsPerSecond = 60; 
    const sidebarWidth = 280;
    const timelineWidth = Math.max(800, safeDuration * pixelsPerSecond);

    const lastManualScrollTime = useRef(0);

    const handleScroll = () => {
        lastManualScrollTime.current = Date.now();
    };

    const lastSelectedId = useRef<string | null>(null);

    // Scroll to active item logic ONLY when selection changes, NOT during dragging (when segments/steps update)
    useEffect(() => {
        if (selectedSegmentId && selectedSegmentId !== lastSelectedId.current && containerRef.current) {
            const allItems = [...segments, ...steps];
            const item = allItems.find(i => i.id === selectedSegmentId);
            if (item) {
                const x = (item.startMs / 1000) * pixelsPerSecond + sidebarWidth;
                const container = containerRef.current;
                
                // Horizontal scroll to center item
                const targetX = x - (container.clientWidth / 2);
                
                // Vertical scroll to center item
                let targetY = 0;
                const stepIndex = steps.findIndex(s => s.id === selectedSegmentId);
                if (stepIndex !== -1) {
                    // py-4 (16px) + Subtitle row (44px) + step index * 44px
                    const itemY = 16 + 44 + (stepIndex * 44);
                    targetY = itemY - (container.clientHeight / 2) + 22; // +22 for half item height
                } else {
                    const isSubtitle = segments.some(s => s.id === selectedSegmentId);
                    if (isSubtitle) {
                        const itemY = 16;
                        targetY = itemY - (container.clientHeight / 2) + 22;
                    }
                }
                
                container.scrollTo({
                    left: Math.max(0, targetX),
                    top: Math.max(0, targetY),
                    behavior: 'smooth'
                });
                
                lastSelectedId.current = selectedSegmentId;
            }
        }
    }, [selectedSegmentId, segments, steps, pixelsPerSecond]);

    // Hardware-accelerated sync loop for playhead
    useEffect(() => {
        let frameId: number;

        const sync = () => {
            const container = containerRef.current;
            const playhead = playheadRef.current;
            const video = videoRef.current;

            if (video && playhead) {
                const x = video.currentTime * pixelsPerSecond + sidebarWidth;
                playhead.style.transform = `translate3d(${x}px, 0, 0)`;
                
                if (container) {
                    const now = Date.now();
                    const isManualScrolling = now - lastManualScrollTime.current < 5000;
                    
                    if (!isManualScrolling) {
                        const scrollLeft = container.scrollLeft;
                        const containerWidth = container.clientWidth;
                        const padding = 100; 
                        
                        const isNearRightEdge = x > (scrollLeft + containerWidth - padding);
                        const isNearLeftEdge = x < (scrollLeft + padding + sidebarWidth);
                        
                        if (isNearRightEdge || isNearLeftEdge) {
                            const isPlaying = video.playbackRate > 0 && !video.paused;
                            if (isPlaying) {
                                const targetScroll = x - (containerWidth / 2);
                                container.scrollTo({
                                    left: Math.max(0, targetScroll),
                                    behavior: 'auto'
                                });
                            }
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
        const x = e.clientX - rect.left - sidebarWidth;
        if (x < 0) return; // Clicked in sidebar
        
        const seekSec = x / pixelsPerSecond;
        onSeek(Math.max(0, Math.min(safeDuration, seekSec)));
    };

    const handleItemMove = (item: VideoTextSegment, onUpdate: (id: string, patch: Partial<VideoTextSegment>) => void) => (e: React.PointerEvent) => {
        e.stopPropagation();
        if (!containerRef.current) return;
        
        const container = containerRef.current;
        const startX = e.clientX;
        const startScrollLeft = container.scrollLeft;
        const initialStartMs = item.startMs;
        const initialEndMs = item.endMs;
        const durationMs = initialEndMs - initialStartMs;
        
        let currentMouseX = e.clientX;
        let animationFrameId: number;
        
        const updatePosition = () => {
            const currentScrollLeft = container.scrollLeft;
            const scrollDelta = currentScrollLeft - startScrollLeft;
            const deltaX = (currentMouseX - startX) + scrollDelta;
            const deltaMs = (deltaX / pixelsPerSecond) * 1000;
            
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
            
            onUpdate(item.id, { 
                startMs: Math.round(newStartMs), 
                endMs: Math.round(newEndMs) 
            });
        };

        const handlePointerMove = (moveEvent: PointerEvent) => {
            currentMouseX = moveEvent.clientX;
            updatePosition();
        };

        const autoScrollTick = () => {
            const rect = container.getBoundingClientRect();
            const EDGE = 60;
            const SPEED = 15;
            
            if (currentMouseX < rect.left + sidebarWidth + EDGE) {
                container.scrollBy({ left: -SPEED });
                updatePosition();
            } else if (currentMouseX > rect.right - EDGE) {
                container.scrollBy({ left: SPEED });
                updatePosition();
            }
            
            animationFrameId = requestAnimationFrame(autoScrollTick);
        };

        const handlePointerUp = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            cancelAnimationFrame(animationFrameId);
            document.body.style.cursor = 'default';
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        document.body.style.cursor = 'grabbing';
        
        animationFrameId = requestAnimationFrame(autoScrollTick);
    };

    const handleItemResize = (item: VideoTextSegment, type: 'start' | 'end', onUpdate: (id: string, patch: Partial<VideoTextSegment>) => void) => (e: React.PointerEvent) => {
        e.stopPropagation();
        if (!containerRef.current) return;
        
        const container = containerRef.current;
        const startX = e.clientX;
        const startScrollLeft = container.scrollLeft;
        const startValueMs = type === 'start' ? item.startMs : item.endMs;
        
        let currentMouseX = e.clientX;
        let animationFrameId: number;
        
        const updatePosition = () => {
            const currentScrollLeft = container.scrollLeft;
            const scrollDelta = currentScrollLeft - startScrollLeft;
            const deltaX = (currentMouseX - startX) + scrollDelta;
            const deltaMs = (deltaX / pixelsPerSecond) * 1000;
            
            const newValueMs = Math.max(0, Math.min(safeDuration * 1000, startValueMs + deltaMs));
            
            if (type === 'start') {
                if (newValueMs < item.endMs - 100) {
                    onUpdate(item.id, { startMs: Math.round(newValueMs) });
                }
            } else {
                if (newValueMs > item.startMs + 100) {
                    onUpdate(item.id, { endMs: Math.round(newValueMs) });
                }
            }
        };

        const handlePointerMove = (moveEvent: PointerEvent) => {
            currentMouseX = moveEvent.clientX;
            updatePosition();
        };

        const autoScrollTick = () => {
            const rect = container.getBoundingClientRect();
            const EDGE = 60;
            const SPEED = 15;
            
            if (currentMouseX < rect.left + sidebarWidth + EDGE) {
                container.scrollBy({ left: -SPEED });
                updatePosition();
            } else if (currentMouseX > rect.right - EDGE) {
                container.scrollBy({ left: SPEED });
                updatePosition();
            }
            
            animationFrameId = requestAnimationFrame(autoScrollTick);
        };

        const handlePointerUp = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            cancelAnimationFrame(animationFrameId);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        
        animationFrameId = requestAnimationFrame(autoScrollTick);
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

    const renderTimelineItem = (item: VideoTextSegment, type: 'subtitle' | 'step', onUpdate: (id: string, patch: Partial<VideoTextSegment>) => void, onSelect: (id: string) => void) => {
        const x = (item.startMs / 1000) * pixelsPerSecond;
        const width = ((item.endMs - item.startMs) / 1000) * pixelsPerSecond;
        const isSelected = selectedSegmentId === item.id;
        const isActive = (currentTimeSec * 1000) >= item.startMs && (currentTimeSec * 1000) <= item.endMs;
        const colorClass = type === 'subtitle' ? 'bg-[#ff7a00]' : 'bg-[#3b82f6]';

        return (
            <div
                key={item.id}
                className={cn(
                    "absolute h-8 top-1.5 rounded-sm cursor-grab active:cursor-grabbing transition-shadow flex items-center overflow-hidden border-x-[2px]",
                    isSelected 
                        ? cn(colorClass, "border-white shadow-[0_0_20px_rgba(255,255,255,0.4)] z-20 scale-[1.02]") 
                        : isActive
                            ? cn(colorClass, "border-white/50 z-15")
                            : cn(colorClass, "opacity-40 border-transparent hover:opacity-60 z-10")
                )}
                style={{ left: `${x}px`, width: `${width}px` }}
                onPointerDown={(e) => {
                    e.stopPropagation();
                    if (videoRef.current) {
                        videoRef.current.currentTime = item.startMs / 1000;
                    }
                    onSelect(item.id);
                    handleItemMove(item, onUpdate)(e);
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div 
                    className="absolute left-0 inset-y-0 w-3 cursor-ew-resize hover:bg-white/20 transition-colors z-30"
                    onPointerDown={handleItemResize(item, 'start', onUpdate)}
                />
                <div 
                    className="absolute right-0 inset-y-0 w-3 cursor-ew-resize hover:bg-white/20 transition-colors z-30"
                    onPointerDown={handleItemResize(item, 'end', onUpdate)}
                />
                <div className="flex flex-col justify-center px-3 pointer-events-none drop-shadow-md overflow-hidden w-full">
                    <span className="text-[10px] font-bold text-white truncate">{item.text}</span>
                    {item.description && (
                        <span className="text-[9px] text-white/70 truncate">{item.description}</span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] rounded-md overflow-hidden border border-white/5 select-none">
            {/* Timeline Toolbar */}
            <div className="bg-[#141414] h-8 flex items-center px-4 border-b border-white/5 justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Timeline</span>
                </div>
                <span className="text-[10px] font-mono text-white/60 tabular-nums bg-white/5 px-2 py-0.5 rounded">
                    {formatVideoTime(currentTimeSec)} / {formatVideoTime(safeDuration)}
                </span>
            </div>

            {/* Scrollable Area */}
            <div 
                ref={containerRef}
                className="flex-1 overflow-auto scrollbar-none relative bg-[#0f0f0f]"
                style={{ scrollBehavior: 'auto' }}
                onScroll={handleScroll}
            >
                <div 
                    ref={trackRef}
                    className="relative min-h-full"
                    style={{ width: `${timelineWidth + sidebarWidth}px` }}
                    onClick={handleTrackClick}
                >
                    {/* Sticky Sidebar Labels */}
                    <div className="absolute left-0 right-0 top-0 bottom-0 z-50 pointer-events-none">
                        <div className="sticky left-0 w-[280px] h-full bg-[#141414] border-r border-white/10 pointer-events-auto flex flex-col shadow-2xl">
                             {/* Empty corner for ruler */}
                             <div className="sticky top-0 z-50 h-8 bg-[#141414] border-b border-white/10 flex items-center px-4 shrink-0">
                                 <span className="text-[9px] font-bold text-white/20 uppercase">Track</span>
                             </div>
                             <div className="flex flex-col py-4 flex-1 overflow-visible">
                                 <div className="h-11 flex items-center px-4 shrink-0 bg-[#0c0c0c] border-b border-white/[0.02]">
                                     <span className="text-[10px] font-bold text-white/60 truncate">Subtitles</span>
                                 </div>
                                 {steps.map((step, index) => {
                                     const isStepActive = selectedSegmentId === step.id;
                                     return (
                                         <button 
                                             key={`label-${step.id}-${index}`} 
                                             className={cn(
                                                 "h-11 flex flex-col justify-center px-4 transition-colors text-left shrink-0 overflow-hidden",
                                                 isStepActive 
                                                     ? "bg-[#252525] border-l-[3px] border-l-[#3b82f6]" 
                                                     : index % 2 === 0 
                                                         ? "bg-[#161616] border-l-[3px] border-l-transparent hover:bg-[#202020]"
                                                         : "bg-[#101010] border-l-[3px] border-l-transparent hover:bg-[#202020]"
                                             )}
                                             onPointerDown={(e) => {
                                                 e.stopPropagation();
                                                 if (videoRef.current) {
                                                     videoRef.current.currentTime = step.startMs / 1000;
                                                 }
                                                 if (onSelectStep) onSelectStep(step.id);
                                             }}
                                             onClick={(e) => e.stopPropagation()}
                                         >
                                             <div className="flex justify-between items-start w-full">
                                                 <div className="flex flex-col overflow-hidden">
                                                     <span className={cn("text-[10px] font-bold truncate", isStepActive ? "text-[#3b82f6]" : "text-white/90")}>
                                                         {step.order}. {step.text}
                                                     </span>
                                                     <span className="text-[9px] text-white/40 truncate">
                                                         {step.description || 'No description'}
                                                     </span>
                                                 </div>
                                                 <span className={cn("text-[9px] font-mono shrink-0 ml-2 mt-0.5", isStepActive ? "text-[#3b82f6]/80" : "text-white/30")}>
                                                     {formatVideoTime(step.startMs / 1000)}
                                                 </span>
                                             </div>
                                         </button>
                                     );
                                 })}
                             </div>
                        </div>
                    </div>

                    {/* Ruler */}
                    <div className="h-8 border-b border-white/10 sticky top-0 bg-[#141414]/95 backdrop-blur-sm z-30" style={{ paddingLeft: `${sidebarWidth}px` }}>
                        <div className="relative h-full">
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
                    </div>

                    {/* Tracks Container */}
                    <div className="flex flex-col py-4 px-0 relative min-h-[160px]" style={{ paddingLeft: `${sidebarWidth}px` }}>
                        {/* Subtitles Track (Single Row) */}
                        <div className="h-11 relative border-b border-white/[0.05] bg-[#0c0c0c] group transition-colors">
                            {segments.map((segment) => renderTimelineItem(segment, 'subtitle', onUpdateSegment, onSelectSegment))}
                        </div>

                        {/* Step Tracks (One Row Per Step) */}
                        {steps.map((step, index) => (
                            <div key={`${step.id}-${index}`} className={cn("h-11 relative border-b border-white/[0.02] group hover:bg-white/[0.04] transition-colors", index % 2 === 0 ? "bg-[#161616]" : "bg-[#101010]")}>
                                {renderTimelineItem(step, 'step', onUpdateStep || onUpdateSegment, onSelectStep || onSelectSegment)}
                            </div>
                        ))}

                        {/* Video Background Tracks Style Capcut */}
                        <div className="h-20 mt-6 relative bg-white/[0.02] border-y border-white/5 flex items-center overflow-hidden">
                             <div className="flex gap-1 h-full opacity-20">
                                {Array.from({ length: Math.min(Math.ceil(timelineWidth / 120), 300) }).map((_, i) => (
                                    <div key={i} className="w-[116px] h-full bg-white/5 shrink-0 border-r border-white/5" />
                                ))}
                             </div>
                        </div>
                    </div>

                    {/* Playhead */}
                    <div 
                        ref={playheadRef}
                        className="absolute top-0 bottom-0 left-0 w-[2px] bg-white z-40 pointer-events-none shadow-[0_0_10px_rgba(255,255,255,0.8)] will-change-transform"
                    >
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full border-2 border-[#ff7a00]" />
                    </div>
                </div>
            </div>
        </div>
    );
}
