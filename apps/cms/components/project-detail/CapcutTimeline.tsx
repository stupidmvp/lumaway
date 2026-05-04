'use client';

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Triangle, Minus, Plus } from 'lucide-react';

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
    const [pixelsPerSecond, setPixelsPerSecond] = useState(100); 

    const safeDuration = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0;
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
                const x = (item.startMs / 1000) * pixelsPerSecond;
                const container = containerRef.current;
                
                // Horizontal scroll to center item (accounting for sidebar)
                const targetX = x - ((container.clientWidth - sidebarWidth) / 2);
                
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
                // x is relative to trackRef (which starts after sidebar)
                const x = video.currentTime * pixelsPerSecond;
                playhead.style.transform = `translate3d(${x}px, 0, 0)`;
                
                if (container) {
                    const now = Date.now();
                    const isManualScrolling = now - lastManualScrollTime.current < 5000;
                    
                    if (!isManualScrolling) {
                        const scrollLeft = container.scrollLeft;
                        const containerWidth = container.clientWidth;
                        const padding = 100; 
                        
                        // absoluteX includes the sidebar for scroll boundary checks
                        const absoluteX = x + sidebarWidth;
                        const isNearRightEdge = absoluteX > (scrollLeft + containerWidth - padding);
                        const isNearLeftEdge = absoluteX < (scrollLeft + padding + sidebarWidth);
                        
                        if (isNearRightEdge || isNearLeftEdge) {
                            const isPlaying = video.playbackRate > 0 && !video.paused;
                            if (isPlaying) {
                                // Scroll to center the playhead in the available track space
                                const targetScroll = absoluteX - ((containerWidth - sidebarWidth) / 2) - sidebarWidth;
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
    }, [videoRef, pixelsPerSecond, timelineWidth, sidebarWidth]);

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
        // Restoring original Blue/Salmon scheme
        const isSelected = selectedSegmentId === item.id;
        const isActive = (currentTimeSec * 1000) >= item.startMs && (currentTimeSec * 1000) <= item.endMs;
        
        const baseColor = isSelected 
            ? (type === 'subtitle' ? '#e67e22' : '#2980b9')
            : 'rgba(255,255,255,0.05)'; 

        const selectionColor = '#ffffff';

        return (
            <div
                key={item.id}
                className={cn(
                    "absolute h-8 top-1.5 rounded-[3px] cursor-grab active:cursor-grabbing transition-all flex items-center overflow-visible border group",
                    type === 'step' ? (isSelected ? "bg-[#2980b9]" : "bg-[#2980b9]/60") : (isSelected ? "bg-[#e67e22]" : "bg-[#e67e22]/60"),
                    isSelected 
                        ? "border-[1.5px] border-white z-20" 
                        : isActive
                            ? "border-white/20 z-15"
                            : "border-transparent z-10"
                )}
                style={{ 
                    left: `${x}px`, 
                    width: `${width}px`,
                }}
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
                {isSelected && <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/30 rounded-t-[3px]" />}
                
                {/* Capcut-style Left Handle */}
                <div 
                    className={cn(
                        "absolute left-[-2px] inset-y-[-2px] w-3 cursor-ew-resize z-30 flex items-center justify-center transition-all",
                        isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}
                    onPointerDown={handleItemResize(item, 'start', onUpdate)}
                >
                    <div 
                        className={cn("w-full h-full rounded-l-[1px] flex items-center justify-center")}
                        style={{ backgroundColor: isSelected ? 'white' : 'rgba(255,255,255,0.05)' }}
                    >
                        <div className={cn("w-[1px] h-3 rounded-full", isSelected ? "bg-black" : "bg-white/20")} />
                    </div>
                </div>
                
                <div className="flex flex-col justify-center px-4 pointer-events-none overflow-hidden w-full select-none">
                    <span className={cn("text-[10px] font-bold truncate tracking-tight text-white")}>
                        {item.text}
                    </span>
                    {item.description && (
                        <span className={cn("text-[8px] truncate leading-tight font-medium text-white/70")}>
                            {item.description}
                        </span>
                    )}
                </div>

                {/* Capcut-style Right Handle */}
                <div 
                    className={cn(
                        "absolute right-[-2px] inset-y-[-2px] w-3 cursor-ew-resize z-30 flex items-center justify-center transition-all",
                        isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}
                    onPointerDown={handleItemResize(item, 'end', onUpdate)}
                >
                    <div 
                        className={cn("w-full h-full rounded-r-[1px] flex items-center justify-center")}
                        style={{ backgroundColor: isSelected ? selectionColor : 'rgba(255,255,255,0.05)' }}
                    >
                        <div className={cn("w-[1px] h-3 rounded-full", isSelected ? "bg-black" : "bg-white/10")} />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-black rounded-xl overflow-hidden border border-white/10 select-none shadow-2xl">
            {/* Timeline Toolbar */}
            <div className="bg-[#111] h-12 flex items-center px-6 border-b border-white/10 justify-between shrink-0 relative z-50">
                {/* Left side actions could go here */}
                <div />

                {/* Right side: Time & Zoom */}
                <div className="flex items-center gap-6">
                    {/* Zoom Control (Capcut Style) */}
                    <div className="flex items-center gap-2 group">
                        <button 
                            onClick={() => setPixelsPerSecond(prev => Math.max(20, prev - 20))}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                        >
                            <Minus className="w-3.5 h-3.5" />
                        </button>
                        
                        <div className="w-32 h-1 bg-white/10 rounded-full relative overflow-hidden group-hover:bg-white/20 transition-colors">
                            <input 
                                type="range" 
                                min="20" 
                                max="500" 
                                value={pixelsPerSecond}
                                onChange={(e) => setPixelsPerSecond(parseInt(e.target.value))}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div 
                                className="absolute top-0 left-0 h-full bg-white transition-all duration-100"
                                style={{ width: `${((pixelsPerSecond - 20) / (500 - 20)) * 100}%` }}
                            />
                        </div>

                        <button 
                            onClick={() => setPixelsPerSecond(prev => Math.min(500, prev + 20))}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="flex items-center gap-3 bg-black/60 px-4 py-1.5 rounded-md border border-white/10 h-8">
                        <span className="text-[11px] font-mono text-white font-bold tabular-nums tracking-wider">
                            {formatVideoTime(currentTimeSec)}
                        </span>
                        <span className="text-[11px] font-mono text-white/20">/</span>
                        <span className="text-[11px] font-mono text-white/50 tabular-nums">
                            {formatVideoTime(safeDuration)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Scrollable Area */}
            <div 
                ref={containerRef}
                className="flex-1 overflow-auto relative custom-scrollbar bg-black"
                style={{ scrollBehavior: 'auto' }}
                onScroll={handleScroll}
            >
                {/* Main Horizontal Content (Flex + Sticky) */}
                <div className="flex relative" style={{ width: `${timelineWidth + sidebarWidth}px` }}>
                    
                    {/* Sticky Sidebar */}
                    <div className="sticky left-0 w-[280px] z-[70] bg-[#0d0d0d] border-r border-white/10 flex flex-col shadow-2xl shrink-0">
                         <div className="flex flex-col py-0 flex-1 overflow-visible">
                             {/* Ruler Spacer (Matches Ruler Height) */}
                             <div className="h-10 shrink-0 border-b border-white/10 bg-[#111]" />

                             {/* Subtitles Row Sidebar */}
                             <div className="h-12 flex items-center px-4 shrink-0 bg-[#161616] border-b border-white/5 relative">
                                 <span className="text-[11px] font-bold text-white/50 truncate uppercase tracking-[0.1em]">Subtitles</span>
                             </div>

                             {/* Section Divider Sidebar */}
                             <div className="h-8 flex items-center px-4 shrink-0 bg-[#0a0a0a] border-b border-white/5">
                                 <span className="text-[9px] font-bold text-white/10 uppercase tracking-[0.2em]">Steps</span>
                             </div>

                             {/* Step Rows Sidebar */}
                             {steps.map((step, index) => {
                                 const isStepActive = selectedSegmentId === step.id;
                                 const isEven = index % 2 === 0;
                                 return (
                                     <button 
                                         key={`label-${step.id}-${index}`} 
                                         className={cn(
                                             "h-12 flex flex-col justify-center px-4 transition-colors text-left shrink-0 overflow-hidden relative border-b border-white/5",
                                             isStepActive 
                                                 ? "bg-white/10 z-10" 
                                                 : isEven 
                                                     ? "bg-[#0d0d0d] hover:bg-[#151515]"
                                                     : "bg-[#0a0a0a] hover:bg-[#151515]"
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
                                         <div className="flex justify-between items-center w-full relative z-10">
                                             <div className="flex flex-col overflow-hidden">
                                                 <span className={cn("text-[10px] font-bold truncate uppercase tracking-[0.1em]", isStepActive ? "text-white" : "text-white/40")}>
                                                     Step {step.order}
                                                 </span>
                                                 <span className={cn("text-[9px] truncate font-medium", isStepActive ? "text-white/70" : "text-white/20")}>
                                                     {step.text}
                                                 </span>
                                             </div>
                                             <span className={cn("text-[10px] font-mono shrink-0 tabular-nums font-bold", isStepActive ? "text-white" : "text-white/20")}>
                                                 {formatVideoTime(step.startMs / 1000)}
                                             </span>
                                         </div>
                                     </button>
                                 );
                             })}
                         </div>
                    </div>

                    {/* Tracks & Ruler Area */}
                    <div 
                        ref={trackRef}
                        className="flex-1 relative min-h-full"
                        onClick={handleTrackClick}
                    >
                        {/* Ruler */}
                        <div className="h-10 border-b border-white/10 sticky top-0 bg-[#111] z-40">
                        <div className="relative h-full">
                            {ticks.map((tick) => (
                                <div 
                                    key={tick.sec} 
                                    className={cn(
                                        "absolute top-0 h-full border-l",
                                        tick.isMajor ? "border-white/30 w-[1px]" : "border-white/10 h-1/4 mt-7"
                                    )}
                                    style={{ left: `${tick.x}px` }}
                                >
                                    {tick.isMajor && (
                                        <span className="text-[9px] text-white/40 -translate-x-1/2 ml-[-1px] mb-1 absolute bottom-1 leading-none font-bold tracking-tight">
                                            {formatVideoTime(tick.sec).split('.')[0]}s
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Tracks Container */}
                    <div className="flex flex-col px-0 relative min-h-[160px]">
                        {/* Subtitles Track Row */}
                        <div className="h-12 relative border-b border-white/[0.05] bg-[#161616] group transition-colors">
                            {segments.map((segment) => renderTimelineItem(segment, 'subtitle', onUpdateSegment, onSelectSegment))}
                        </div>

                        {/* Section Divider Track Area (Matches Sidebar Height) */}
                        <div className="h-8 bg-[#0a0a0a] border-b border-white/5 relative" />

                        {/* Step Track Rows */}
                        {steps.map((step, index) => {
                            const isEven = index % 2 === 0;
                            return (
                                <div key={`${step.id}-${index}`} className={cn("h-12 relative border-b border-white/5 group hover:bg-white/[0.02] transition-colors", isEven ? "bg-[#0d0d0d]" : "bg-[#0a0a0a]")}>
                                    {renderTimelineItem(step, 'step', onUpdateStep || onUpdateSegment, onSelectStep || onSelectSegment)}
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

                    {/* Playhead (Standard Icon Style) */}
                    <div 
                        ref={playheadRef}
                        className="absolute top-0 bottom-0 left-0 w-[1.5px] z-[60] pointer-events-none will-change-transform"
                    >
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center">
                            {/* Lucide Triangle Icon as Head - Pixel Perfect Alignment */}
                            <div className="relative z-10 top-[2px]">
                                <Triangle 
                                    className="w-[14px] h-[14px] fill-white text-black stroke-[1px] rotate-180 drop-shadow-md"
                                />
                            </div>
                            {/* Vertical Line - Starts exactly from the triangle tip */}
                            <div className="w-[1.5px] h-[3000px] bg-white shadow-[0_0_10px_rgba(255,255,255,0.3)] -mt-[1px]" />
                        </div>
                    </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
