'use client';

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Triangle, Minus, Plus } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
    Play, 
    Pause, 
    Captions, 
    Settings2, 
    ChevronDown, 
    Check,
    Languages,
    Trash2,
    RotateCcw,
    RotateCw,
    Download,
    Volume2,
    VolumeX,
    SquareSplitHorizontal
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';

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
    isPlaying?: boolean;
    onTogglePlayback?: () => void;
    playbackRate?: number;
    onPlaybackRateChange?: (rate: number) => void;
    showSubtitles?: boolean;
    onToggleSubtitles?: () => void;
    volume?: number;
    onVolumeChange?: (val: number) => void;
    onSplitStep?: () => void;
    onDeleteStep?: (id: string) => void;
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
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
    isPlaying = false,
    onTogglePlayback,
    playbackRate = 1,
    onPlaybackRateChange,
    showSubtitles = true,
    onToggleSubtitles,
    volume = 1,
    onVolumeChange,
    onSplitStep,
    onDeleteStep,
    onUndo,
    onRedo,
    canUndo = false,
    canRedo = false,
}: CapcutTimelineProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const playheadRef = useRef<HTMLDivElement>(null);
    const [pixelsPerSecond, setPixelsPerSecond] = useState(100); 

    const safeDuration = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0;
    const sidebarWidth = 280;
    const TIMELINE_PADDING_LEFT = 24;
    // Keyboard Shortcuts for Zoom
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.metaKey || e.ctrlKey) {
                if (e.key === '=' || e.key === '+') {
                    e.preventDefault();
                    setPixelsPerSecond(prev => Math.min(500, prev + 20));
                } else if (e.key === '-') {
                    e.preventDefault();
                    setPixelsPerSecond(prev => Math.max(20, prev - 20));
                }
            }
            
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                onSplitStep?.();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onSplitStep]);

    const timelineWidth = Math.max(800, (safeDuration * pixelsPerSecond) + TIMELINE_PADDING_LEFT + 200);

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
                const x = TIMELINE_PADDING_LEFT + (video.currentTime * pixelsPerSecond);
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
        const x = e.clientX - rect.left - TIMELINE_PADDING_LEFT;
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
            x: TIMELINE_PADDING_LEFT + (i * interval * pixelsPerSecond),
            isMajor: i % 5 === 0
        }));
    }, [safeDuration, pixelsPerSecond]);

    const renderTimelineItem = (item: VideoTextSegment, type: 'subtitle' | 'step', onUpdate: (id: string, patch: Partial<VideoTextSegment>) => void, onSelect: (id: string) => void) => {
        const x = TIMELINE_PADDING_LEFT + ((item.startMs / 1000) * pixelsPerSecond);
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
                    "absolute h-8 top-1.5 rounded-[3px] cursor-grab active:cursor-grabbing flex items-center overflow-visible border group",
                    type === 'step' ? (isSelected ? "bg-[#2980b9]" : "bg-[#2980b9]/60") : (isSelected ? "bg-[#e67e22]" : "bg-[#e67e22]/60"),
                    isSelected 
                        ? "border-[1.5px] border-white z-20 shadow-[0_4px_12px_rgba(0,0,0,0.3)]" 
                        : isActive
                            ? "border-white/20 z-15"
                            : "border-white/10 z-10"
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
                        className={cn(
                            "w-full h-full rounded-l-[2px] flex items-center justify-center border-r border-black/5 shadow-sm transition-colors",
                            isSelected ? "bg-white" : "bg-white/40"
                        )}
                    >
                        <div className={cn("w-[1.5px] h-3 rounded-full", isSelected ? "bg-black/40" : "bg-black/20")} />
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
                        className={cn(
                            "w-full h-full rounded-r-[2px] flex items-center justify-center border-l border-black/5 shadow-sm transition-colors",
                            isSelected ? "bg-white" : "bg-white/40"
                        )}
                    >
                        <div className={cn("w-[1.5px] h-3 rounded-full", isSelected ? "bg-black/40" : "bg-black/20")} />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden border border-border select-none shadow-2xl">
            {/* Toolbar (Capcut Style) */}
            <div className="h-14 border-b border-border bg-white flex items-center px-4 shrink-0 gap-4">
                {/* Left side: Editing Tools */}
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 gap-2 px-3 text-[11px] font-bold text-foreground/70 hover:bg-secondary/50"
                                    onClick={() => onSplitStep?.()}
                                >
                                    <SquareSplitHorizontal className="w-3.5 h-3.5" />
                                    Dividir
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-[10px]">Dividir (⌘B)</TooltipContent>
                        </Tooltip>

                        <div className="w-px h-4 bg-border/80 mx-1 shrink-0" />
                        
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-foreground/50 hover:text-foreground"
                                    onClick={() => {
                                        if (selectedSegmentId) onDeleteStep?.(selectedSegmentId);
                                    }}
                                    disabled={!selectedSegmentId}
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-[10px]">Borrar (Del)</TooltipContent>
                        </Tooltip>

                        <div className="w-px h-4 bg-border/80 mx-1 shrink-0" />

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-foreground/50 hover:text-foreground"
                                    onClick={() => onUndo?.()}
                                    disabled={!canUndo}
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-[10px]">Deshacer (⌘Z)</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-foreground/50 hover:text-foreground"
                                    onClick={() => onRedo?.()}
                                    disabled={!canRedo}
                                >
                                    <RotateCw className="w-3.5 h-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-[10px]">Rehacer (⌘⇧Z)</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                {/* Center: Playback Controls */}
                <div className="flex items-center gap-4 px-6">
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={onTogglePlayback}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-black text-white hover:scale-105 transition-all shadow-lg active:scale-95 shrink-0"
                        >
                            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                        </button>
                        
                        <div className="flex items-center gap-1 font-mono text-[11px] tracking-tight tabular-nums whitespace-nowrap bg-secondary/20 px-2 py-0.5 rounded border border-border/50">
                            <span className="text-foreground font-black">
                                {formatVideoTime(currentTimeSec).split('.')[0]}
                            </span>
                            <span className="text-foreground/20 font-bold">/</span>
                            <span className="text-foreground/40 font-medium">
                                {formatVideoTime(durationSec).split('.')[0]}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right side: Zoom & Config */}
                <div className="flex-1 flex items-center justify-end gap-4 min-w-0">
                    {/* Zoom Control Group (Right Side per reference) */}
                    <div className="flex items-center gap-1 group shrink-0">
                        <button 
                            onClick={() => setPixelsPerSecond(prev => Math.max(20, prev - 20))}
                            disabled={pixelsPerSecond <= 20}
                            className="text-foreground/40 hover:text-foreground p-1 transition-opacity disabled:opacity-10"
                        >
                            <Minus className="w-3 h-3" />
                        </button>
                        <div className="w-20 sm:w-28 relative flex items-center mx-1">
                            <Slider 
                                min={20}
                                max={500}
                                step={1}
                                value={[pixelsPerSecond]}
                                onValueChange={(val) => setPixelsPerSecond(val[0])}
                                className="cursor-pointer"
                            />
                        </div>
                        <button 
                            onClick={() => setPixelsPerSecond(prev => Math.min(500, prev + 20))}
                            disabled={pixelsPerSecond >= 500}
                            className="text-foreground/40 hover:text-foreground p-1 transition-opacity disabled:opacity-10"
                        >
                            <Plus className="w-3 h-3" />
                        </button>
                    </div>

                    <div className="w-px h-4 bg-border/80 shrink-0" />

                    {/* CC & Volume Buttons */}
                    <div className="flex items-center gap-1">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={onToggleSubtitles}
                            className={cn(
                                "h-8 w-8 rounded-md",
                                showSubtitles ? "text-sky-500 bg-sky-50/50" : "text-foreground/40 hover:text-foreground"
                            )}
                        >
                            <Captions className="w-3.5 h-3.5" />
                        </Button>
                        
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground/40 hover:text-foreground">
                                    <Volume2 className="w-3.5 h-3.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="p-3 w-40">
                                <div className="flex flex-col gap-3">
                                    <div className="flex justify-between items-center text-[10px] font-bold uppercase text-foreground/40">
                                        <span>Volumen</span>
                                        <span className="font-mono">{Math.round(volume * 100)}%</span>
                                    </div>
                                    <Slider 
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={[volume]}
                                        onValueChange={(val) => onVolumeChange?.(val[0])}
                                        className="w-full cursor-pointer"
                                    />
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 px-2 text-[10px] font-bold text-foreground/60 hover:text-foreground hover:bg-secondary/50">
                                    {playbackRate}x
                                    <ChevronDown className="w-3 h-3 opacity-50 ml-0.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[80px]">
                                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                                    <DropdownMenuItem 
                                        key={rate} 
                                        className="text-[11px] font-medium flex items-center justify-between"
                                        onClick={() => onPlaybackRateChange?.(rate)}
                                    >
                                        {rate}x
                                        {playbackRate === rate && <Check className="w-3 h-3 text-sky-500" />}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>


            {/* Scrollable Area */}
            <div 
                ref={containerRef}
                className="flex-1 overflow-auto relative custom-scrollbar bg-background"
                style={{ scrollBehavior: 'auto' }}
                onScroll={handleScroll}
            >
                {/* Main Horizontal Content (Flex + Sticky) */}
                <div className="flex relative" style={{ width: `${timelineWidth + sidebarWidth}px` }}>
                    
                    {/* Sticky Sidebar */}
                    <div className="sticky left-0 w-[280px] z-[70] bg-background border-r border-border flex flex-col shadow-2xl shrink-0">
                         <div className="flex flex-col py-0 flex-1 overflow-visible">
                             {/* Ruler Spacer (Matches Ruler Height) */}
                             <div className="h-10 shrink-0 border-b border-border bg-secondary/50" />

                             {/* Subtitles Row Sidebar */}
                             <div className="h-12 flex items-center px-4 shrink-0 bg-secondary/30 border-b border-border/50 relative">
                                 <span className="text-[11px] font-bold text-foreground/80 truncate uppercase tracking-[0.1em]">Subtitles</span>
                             </div>

                             {/* Section Divider Sidebar */}
                             <div className="h-8 flex items-center px-4 shrink-0 bg-background border-b border-border/50">
                                 <span className="text-[9px] font-bold text-foreground/40 uppercase tracking-[0.2em]">Steps</span>
                             </div>

                             {/* Step Rows Sidebar */}
                             {steps.map((step, index) => {
                                 const isStepActive = selectedSegmentId === step.id;
                                 const isEven = index % 2 === 0;
                                 return (
                                     <button 
                                         key={`label-${step.id}-${index}`} 
                                         className={cn(
                                             "h-12 flex flex-col justify-center px-4 transition-colors text-left shrink-0 overflow-hidden relative border-b border-border/50",
                                             isStepActive 
                                                 ? "bg-foreground/5 z-10" 
                                                 : isEven 
                                                     ? "bg-background hover:bg-secondary/50"
                                                     : "bg-secondary/20 hover:bg-secondary/50"
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
                                                 <span className={cn("text-[10px] font-bold truncate uppercase tracking-[0.1em]", isStepActive ? "text-foreground" : "text-foreground/40")}>
                                                     Step {step.order}
                                                 </span>
                                                 <span className={cn("text-[9px] truncate font-medium", isStepActive ? "text-foreground/70" : "text-foreground/20")}>
                                                     {step.text}
                                                 </span>
                                             </div>
                                             <span className={cn("text-[10px] font-mono shrink-0 tabular-nums font-bold", isStepActive ? "text-foreground" : "text-foreground/20")}>
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
                        <div className="h-10 border-b border-border sticky top-0 bg-secondary/50 backdrop-blur-sm z-40">
                        <div className="relative h-full">
                            {ticks.map((tick) => (
                                <div 
                                    key={tick.sec} 
                                    className={cn(
                                        "absolute top-0 h-full border-l",
                                        tick.isMajor ? "border-black/20 w-[1.5px]" : "border-black/10 h-1.5 mt-auto"
                                    )}
                                    style={{ left: `${tick.x}px` }}
                                >
                                    {tick.isMajor && (
                                        <span className="text-[10px] text-foreground/70 -translate-x-1/2 ml-[-1px] mb-1 absolute bottom-1.5 leading-none font-bold tracking-tight">
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
                        <div className="h-12 relative border-b border-border/50 bg-secondary/30 group transition-colors">
                            {segments.map((segment) => renderTimelineItem(segment, 'subtitle', onUpdateSegment, onSelectSegment))}
                        </div>

                        {/* Section Divider Track Area (Matches Sidebar Height) */}
                        <div className="h-8 bg-background border-b border-border/50 relative" />

                        {/* Step Track Rows */}
                        {steps.map((step, index) => {
                            const isEven = index % 2 === 0;
                            return (
                                <div key={`${step.id}-${index}`} className={cn("h-12 relative border-b border-border/50 group hover:bg-foreground/[0.02] transition-colors", isEven ? "bg-background" : "bg-secondary/20")}>
                                    {renderTimelineItem(step, 'step', onUpdateStep || onUpdateSegment, onSelectStep || onSelectSegment)}
                                </div>
                            );
                        })}

                        {/* Video Background Tracks Style Capcut */}
                        <div className="h-20 mt-6 relative bg-foreground/[0.02] border-y border-border flex items-center overflow-hidden">
                             <div className="flex gap-1 h-full opacity-20">
                                {Array.from({ length: Math.min(Math.ceil(timelineWidth / 120), 300) }).map((_, i) => (
                                    <div key={i} className="w-[116px] h-full bg-foreground/5 shrink-0 border-r border-border" />
                                ))}
                             </div>
                        </div>
                    </div>

                    {/* Playhead (Standard Icon Style) */}
                    <div 
                        ref={playheadRef}
                        className="absolute top-0 bottom-0 left-0 w-[1.5px] z-[60] pointer-events-none will-change-transform"
                    >
                        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center">
                            {/* Lucide Triangle Icon as Head - Pixel Perfect Alignment */}
                            <div className="relative z-[70] top-0 flex-none">
                                <Triangle 
                                    className="w-[12px] h-[12px] fill-black text-black rotate-180 drop-shadow-sm"
                                />
                            </div>
                            {/* Vertical Line - Starts exactly from the triangle tip and stretches to bottom */}
                            <div className="w-[1.5px] flex-1 bg-black/80 shadow-[0_0_8px_rgba(0,0,0,0.15)] -mt-[0.5px]" />
                        </div>
                    </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
