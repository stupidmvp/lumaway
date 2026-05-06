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
    DndContext, 
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { 
    Play, 
    Pause, 
    Captions, 
    Settings2, 
    ChevronDown, 
    Check,
    Languages,
    Trash2,
    Undo2,
    Redo2,
    Download,
    Volume2,
    VolumeX,
    SquareSplitHorizontal,
    Combine
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
    onSelectSegment: (id: string, fromTimeline?: boolean) => void;
    onUpdateStep?: (id: string, patch: Partial<VideoTextSegment>) => void;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    isPlaying?: boolean;
    onTogglePlayback?: () => void;
    playbackRate?: number;
    onPlaybackRateChange?: (rate: number) => void;
    showSubtitles?: boolean;
    onToggleSubtitles?: () => void;
    volume?: number;
    lastVolume?: number;
    onVolumeChange?: (val: number) => void;
    onSplitStep?: () => void;
    onDeleteStep?: (id: string) => void;
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
    onDragEnd?: () => void;
    onReorderSteps?: (newSteps: any[]) => void;
    onSelectStep?: (id: string, multi?: boolean, fromTimeline?: boolean) => void;
    onMergeSteps?: () => void;
    selectedStepIds?: Set<string>;
    t?: (k: string) => string;
}

function formatVideoTime(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${ms}`;
}

interface SortableStepItemProps {
    step: any;
    index: number;
    selectedStepIds: Set<string>;
    selectedSegmentId: string | null;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    onSelectStep?: (id: string, multi?: boolean) => void;
}

function SortableStepItem({ 
    step, 
    index, 
    selectedStepIds, 
    selectedSegmentId, 
    videoRef,
    onSelectStep 
}: SortableStepItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: step.id });

    const style = {
        transform: transform ? `translate3d(0px, ${Math.round(transform.y)}px, 0)` : undefined,
        transition,
        zIndex: isDragging ? 100 : undefined,
    };

    const isStepSelected = selectedStepIds.has(step.id);
    const isStepActive = selectedSegmentId === step.id || isStepSelected;
    const isEven = index % 2 === 0;

    const localRef = useRef<HTMLDivElement | null>(null);

    const setRefs = (node: HTMLDivElement | null) => {
        setNodeRef(node);
        localRef.current = node;
    };

    useEffect(() => {
        if (isStepActive && localRef.current) {
            localRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, [isStepActive]);

    return (
        <div
            ref={setRefs}
            style={style}
            className={cn(
                "h-12 flex items-center transition-all duration-300 ease-out text-left shrink-0 overflow-hidden relative border-b border-border/50 group outline-none focus:outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none",
                isStepActive 
                    ? "bg-sky-600 text-white z-10 shadow-lg scale-[1.02] px-2" 
                    : isEven 
                        ? "bg-background hover:bg-secondary/50"
                        : "bg-secondary/20 hover:bg-secondary/50",
                isDragging && "opacity-50 grayscale"
            )}
        >
            <div 
                {...attributes} 
                {...listeners}
                className={cn(
                    "pl-2 pr-1 cursor-grab active:cursor-grabbing transition-opacity outline-none focus:outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none",
                    isStepActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}
            >
                <GripVertical className={cn("w-4 h-4", isStepActive ? "text-white/70" : "text-foreground/40")} />
            </div>

            <button 
                className="flex-1 h-full flex flex-col justify-center pr-4 overflow-hidden text-left outline-none focus:outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none"
                onPointerDown={(e) => {
                    e.stopPropagation();
                    if (videoRef.current) {
                        videoRef.current.currentTime = step.startMs / 1000;
                    }
                    if (onSelectStep) onSelectStep(step.id, e.shiftKey || e.metaKey || e.ctrlKey);
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center w-full relative z-10">
                    <div className="flex flex-col overflow-hidden items-start">
                        <span className={cn(
                            "text-[11px] font-black truncate uppercase tracking-[0.15em]", 
                            isStepActive ? "text-white" : "text-foreground/40"
                        )}>
                            Step {step.order}
                        </span>
                        <span className={cn("text-[10px] truncate font-bold leading-tight", isStepActive ? "text-sky-50" : "text-foreground/60")}>
                            {step.text}
                        </span>
                    </div>
                    <span className={cn("text-[11px] font-mono shrink-0 tabular-nums font-black", isStepActive ? "text-white" : "text-foreground/20")}>
                        {formatVideoTime(step.startMs / 1000)}
                    </span>
                </div>
            </button>
        </div>
    );
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
    videoRef,
    isPlaying = false,
    onTogglePlayback,
    playbackRate = 1,
    onPlaybackRateChange,
    showSubtitles = true,
    onToggleSubtitles,
    volume = 1,
    lastVolume = 1,
    onVolumeChange,
    onSplitStep,
    onDeleteStep,
    onUndo,
    onRedo,
    canUndo = false,
    canRedo = false,
    onDragEnd,
    onReorderSteps,
    onSelectStep,
    onMergeSteps,
    selectedStepIds = new Set(),
    t = (k: string) => k,
}: CapcutTimelineProps) {
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEndSidebar = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = steps.findIndex((s) => s.id === active.id);
            const newIndex = steps.findIndex((s) => s.id === over.id);
            const newSteps = arrayMove(steps, oldIndex, newIndex);
            if (onReorderSteps) onReorderSteps(newSteps);
            
            // Delay selection to allow the timeline to settle
            setTimeout(() => {
                const id = String(active.id);
                if (onSelectStep) onSelectStep(id, false, true);
                focusOnSegment(id);
            }, 200);
        }
    };
    const containerRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const playheadRef = useRef<HTMLDivElement>(null);
    const [pixelsPerSecond, setPixelsPerSecond] = useState(100); 
    const [draggedItem, setDraggedItem] = useState<{ id: string; startMs: number; endMs: number } | null>(null);
    const isDraggingItemRef = useRef(false);
    const [localSelectedId, setLocalSelectedId] = useState<string | null>(selectedSegmentId);
    const lastPropSelectedId = useRef<string | null>(selectedSegmentId);
    
    // Sync local selection with prop only when prop actually changes from outside
    useEffect(() => {
        if (selectedSegmentId !== lastPropSelectedId.current) {
            setLocalSelectedId(selectedSegmentId);
            lastPropSelectedId.current = selectedSegmentId;
        }
    }, [selectedSegmentId]);

    const lastPlayheadX = useRef<number>(0);
    const lastManualFocusTime = useRef<number>(0);
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

    const focusOnSegment = (id: string) => {
        if (!containerRef.current) return;
        const allItems = [...segments, ...steps];
        const item = allItems.find(i => i.id === id);
        
        if (item) {
            const isNewSelection = id !== lastSelectedId.current;
            lastSelectedId.current = id;
            
            // 1. Playhead Jump - Always jump if new selection, otherwise check tolerance
            let shouldJumpPlayhead = isNewSelection;
            if (videoRef.current && !shouldJumpPlayhead) {
                const targetTime = item.startMs / 1000;
                if (Math.abs(videoRef.current.currentTime - targetTime) > 0.1) {
                    shouldJumpPlayhead = true;
                }
            }
            
            if (shouldJumpPlayhead && videoRef.current) {
                videoRef.current.currentTime = item.startMs / 1000;
                lastPlayheadX.current = TIMELINE_PADDING_LEFT + (item.startMs / 1000 * pixelsPerSecond);
            }

            const x = TIMELINE_PADDING_LEFT + ((item.startMs / 1000) * pixelsPerSecond);
            const container = containerRef.current;
            const targetX = x - 100;
            
            // 2. Scroll Logic
            const scrollLeft = container.scrollLeft;
            const viewportWidth = container.clientWidth - sidebarWidth;
            const isVisibleHorizontally = x >= scrollLeft + 50 && x <= (scrollLeft + viewportWidth - 150);

            let targetY = 0;
            const stepIndex = steps.findIndex(s => s.id === id);
            if (stepIndex !== -1) {
                const itemY = 16 + 44 + (stepIndex * 44);
                targetY = itemY - (container.clientHeight / 2) + 22;
            } else {
                const isSubtitle = segments.some(s => s.id === id);
                if (isSubtitle) {
                    targetY = 16 - (container.clientHeight / 2) + 22;
                }
            }
            
            const scrollTop = container.scrollTop;
            const isVisibleVertically = Math.abs(targetY - scrollTop) < 50;

            // Only scroll if it's a new selection OR it's truly off-screen
            const shouldScroll = isNewSelection || !isVisibleHorizontally || !isVisibleVertically;

            if (shouldScroll) {
                container.scrollTo({
                    left: isNewSelection ? Math.max(0, targetX) : (isVisibleHorizontally ? scrollLeft : Math.max(0, targetX)),
                    top: isNewSelection ? Math.max(0, targetY) : (isVisibleVertically ? scrollTop : Math.max(0, targetY)),
                    behavior: 'smooth'
                });
            }
        }
    };

    useEffect(() => {
        if (selectedSegmentId && containerRef.current) {
            const video = videoRef.current;
            const isPlaying = video && !video.paused && video.playbackRate > 0;
            
            // Skip auto-focus if playing, but still update the lastSelectedId
            if (isPlaying) {
                lastSelectedId.current = selectedSegmentId;
                return;
            }
            
            // If the ID changed, trigger focus
            if (selectedSegmentId !== lastSelectedId.current) {
                focusOnSegment(selectedSegmentId);
                lastSelectedId.current = selectedSegmentId;
            }
        }
    }, [selectedSegmentId, steps, segments, pixelsPerSecond]);

    useEffect(() => {
        let frameId: number;

        const sync = () => {
            const container = containerRef.current;
            const playhead = playheadRef.current;
            const video = videoRef.current;

            if (video && playhead) {
                const x = TIMELINE_PADDING_LEFT + (video.currentTime * pixelsPerSecond);
                playhead.style.transform = `translate3d(${x}px, 0, 0)`;
                const absoluteX = x + sidebarWidth;
                
                if (container) {
                    const now = Date.now();
                    const isManualScrolling = now - lastManualScrollTime.current < 2000;
                    
                    const containerWidth = container.clientWidth;
                    const trackVisibleWidth = containerWidth - sidebarWidth;
                    const isPlaying = video.playbackRate > 0 && !video.paused;
                    
                    const playheadInTrackX = x;
                    const scrollLeft = container.scrollLeft;
                    const visibleTrackLeft = scrollLeft;
                    const visibleTrackRight = visibleTrackLeft + trackVisibleWidth;
 
                    // CRITICAL: Use the REF to check dragging state inside the sync loop closure
                    if (!isDraggingItemRef.current) {
                        const hasPlayheadMoved = Math.abs(playheadInTrackX - lastPlayheadX.current) > 0.1;
                        const isRecentlyFocused = Date.now() - lastManualFocusTime.current < 500;

                        // If playing, we only follow when hitting the right edge (e.g., 90% of visible area)
                        if (isPlaying && !isManualScrolling && !isRecentlyFocused) {
                            const rightThreshold = visibleTrackRight - 100;
                            if (playheadInTrackX > rightThreshold) {
                                // Page forward smoothly
                                const targetScroll = playheadInTrackX - 100;
                                container.scrollTo({
                                    left: Math.max(0, targetScroll),
                                    behavior: 'smooth'
                                });
                            }
                        } else if (!isPlaying && hasPlayheadMoved && !isRecentlyFocused) {
                            // ONLY jump if the playhead itself moved (scrubbing), not if the container just scrolled
                            const margin = 40;
                            if (playheadInTrackX > visibleTrackRight - margin || playheadInTrackX < visibleTrackLeft + margin) {
                                const targetScroll = playheadInTrackX - (trackVisibleWidth / 2);
                                container.scrollLeft = Math.max(0, targetScroll);
                            }
                        }
                    }
                    lastPlayheadX.current = playheadInTrackX;
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
        if (x < 0) return;
        
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
        
        // Pause playback when dragging starts
        if (videoRef.current) videoRef.current.pause();

        // Delay state update until threshold is crossed
        let currentMouseX = e.clientX;
        let animationFrameId: number;
        let hasMovedBeyondThreshold = false;
        const THRESHOLD = 5;
        
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
            
            setDraggedItem({
                id: item.id,
                startMs: Math.round(newStartMs),
                endMs: Math.round(newEndMs)
            });
        };

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const deltaX = Math.abs(moveEvent.clientX - startX);
            if (!hasMovedBeyondThreshold && deltaX > THRESHOLD) {
                hasMovedBeyondThreshold = true;
                isDraggingItemRef.current = true;
                setDraggedItem({
                    id: item.id,
                    startMs: Math.round(initialStartMs),
                    endMs: Math.round(initialEndMs)
                });
                document.body.style.cursor = 'grabbing';
            }
            
            if (hasMovedBeyondThreshold) {
                currentMouseX = moveEvent.clientX;
                updatePosition();
            }
        };

        const autoScrollTick = () => {
            if (!hasMovedBeyondThreshold) {
                animationFrameId = requestAnimationFrame(autoScrollTick);
                return;
            }
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

        const handlePointerUp = (upEvent: PointerEvent) => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            cancelAnimationFrame(animationFrameId);
            document.body.style.cursor = 'default';
            
            const currentScrollLeft = container.scrollLeft;
            const scrollDelta = currentScrollLeft - startScrollLeft;
            const finalDeltaX = (upEvent.clientX - startX) + scrollDelta;
            const finalDeltaMs = (finalDeltaX / pixelsPerSecond) * 1000;
            
            let finalStartMs = initialStartMs + finalDeltaMs;
            let finalEndMs = initialEndMs + finalDeltaMs;

            if (finalStartMs < 0) {
                finalStartMs = 0;
                finalEndMs = durationMs;
            }
            if (finalEndMs > safeDuration * 1000) {
                finalEndMs = safeDuration * 1000;
                finalStartMs = finalEndMs - durationMs;
            }
            // Only trigger data update and re-focus if we actually moved
            if (hasMovedBeyondThreshold) {
                onUpdate(item.id, { 
                    startMs: Math.round(finalStartMs), 
                    endMs: Math.round(finalEndMs) 
                });
                
                // Delay selection to allow the timeline to settle after drag
                setTimeout(() => {
                    if (onSelectStep) {
                        onSelectStep(item.id, false, true);
                    }
                    focusOnSegment(item.id);
                }, 200);
            }

            setDraggedItem(null);
            isDraggingItemRef.current = false;
            if (onDragEnd) onDragEnd();
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        document.body.style.cursor = 'grabbing';
        
        animationFrameId = requestAnimationFrame(autoScrollTick);
    };

    const handleItemResize = (item: VideoTextSegment, type: 'start' | 'end', onUpdate: (id: string, patch: Partial<VideoTextSegment>) => void) => (e: React.PointerEvent) => {
        e.stopPropagation();
        
        // Ensure item is selected even when clicking resizers
        setLocalSelectedId(item.id);
        if (onSelectStep) onSelectStep(item.id, e.shiftKey || e.metaKey, true);

        if (!containerRef.current) return;
        
        const container = containerRef.current;
        const startX = e.clientX;
        const startScrollLeft = container.scrollLeft;
        const startValueMs = type === 'start' ? item.startMs : item.endMs;
        
        // Pause playback when resizing starts
        if (videoRef.current) videoRef.current.pause();

        // We don't set isDraggingItemRef.current = true yet
        // We wait for the threshold in handlePointerMove
        let currentMouseX = e.clientX;
        let animationFrameId: number;
        let hasMovedBeyondThreshold = false;
        const THRESHOLD = 5;
        
        const updatePosition = () => {
            const currentScrollLeft = container.scrollLeft;
            const scrollDelta = currentScrollLeft - startScrollLeft;
            const deltaX = (currentMouseX - startX) + scrollDelta;
            const deltaMs = (deltaX / pixelsPerSecond) * 1000;
            
            const newValueMs = Math.max(0, Math.min(safeDuration * 1000, startValueMs + deltaMs));
            
            if (type === 'start') {
                const newStart = Math.round(newValueMs);
                if (newStart < item.endMs - 100) {
                    setDraggedItem({ id: item.id, startMs: newStart, endMs: item.endMs });
                }
            } else {
                const newEnd = Math.round(newValueMs);
                if (newEnd > item.startMs + 100) {
                    setDraggedItem({ id: item.id, startMs: item.startMs, endMs: newEnd });
                }
            }
        };

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const deltaX = Math.abs(moveEvent.clientX - startX);
            if (!hasMovedBeyondThreshold && deltaX > THRESHOLD) {
                hasMovedBeyondThreshold = true;
                isDraggingItemRef.current = true;
                document.body.style.cursor = 'ew-resize';
            }
            
            if (hasMovedBeyondThreshold) {
                currentMouseX = moveEvent.clientX;
                updatePosition();
            }
        };

        const autoScrollTick = () => {
            if (!hasMovedBeyondThreshold) {
                animationFrameId = requestAnimationFrame(autoScrollTick);
                return;
            }
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

        const handlePointerUp = (upEvent: PointerEvent) => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            cancelAnimationFrame(animationFrameId);
            
            const currentScrollLeft = container.scrollLeft;
            const scrollDelta = currentScrollLeft - startScrollLeft;
            const finalDeltaX = (upEvent.clientX - startX) + scrollDelta;
            const finalDeltaMs = (finalDeltaX / pixelsPerSecond) * 1000;
            const finalValueMs = Math.max(0, Math.min(safeDuration * 1000, startValueMs + finalDeltaMs));

            if (hasMovedBeyondThreshold) {
                if (type === 'start') {
                    if (finalValueMs < item.endMs - 100) {
                        onUpdate(item.id, { startMs: Math.round(finalValueMs) });
                    }
                } else {
                    if (finalValueMs > item.startMs + 100) {
                        onUpdate(item.id, { endMs: Math.round(finalValueMs) });
                    }
                }
                setTimeout(() => {
                    if (onSelectStep) {
                        onSelectStep(item.id, false, true);
                    }
                    focusOnSegment(item.id);
                }, 200);
            }

            setDraggedItem(null);
            isDraggingItemRef.current = false;
            if (onDragEnd) onDragEnd();
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

    const renderTimelineItem = (item: VideoTextSegment, type: 'subtitle' | 'step', onUpdate: (id: string, patch: Partial<VideoTextSegment>) => void) => {
        const isCurrentlyDragged = draggedItem?.id === item.id;
        const currentStartMs = isCurrentlyDragged ? draggedItem.startMs : item.startMs;
        const currentEndMs = isCurrentlyDragged ? draggedItem.endMs : item.endMs;

        const x = TIMELINE_PADDING_LEFT + ((currentStartMs / 1000) * pixelsPerSecond);
        const width = ((currentEndMs - currentStartMs) / 1000) * pixelsPerSecond;
        // Direct and simple selection check - using local state for instant feedback
        const isSelected = item.id === localSelectedId || (selectedStepIds instanceof Set && selectedStepIds.has(item.id));
        const isActive = (currentTimeSec * 1000) >= currentStartMs && (currentTimeSec * 1000) <= currentEndMs;
        
        return (
            <div
                key={item.id}
                className={cn(
                    "absolute h-8 top-2 rounded-[3px] cursor-grab active:cursor-grabbing flex items-center overflow-visible border group pointer-events-auto",
                    type === 'step' ? (isSelected ? "bg-[#6366f1]" : "bg-[#6366f1]/80") : (isSelected ? "bg-foreground/20 dark:bg-[#3a3a3e]" : "bg-foreground/10 dark:bg-[#2a2a2e]"),
                    isSelected 
                        ? "border-[2px] border-foreground/40 dark:border-white z-[60] shadow-xl ring-2 ring-foreground/20 dark:ring-white/30" 
                        : isActive
                            ? "border-foreground/30 dark:border-white/20 z-40"
                            : "border-foreground/10 dark:border-white/10 z-30"
                )}
                style={{ 
                    left: `${x}px`, 
                    width: `${width}px`,
                }}
                onPointerDown={(e) => {
                    e.stopPropagation();
                    
                    // 1. Immediate Visual & Global Selection
                    if (localSelectedId !== item.id) {
                        setLocalSelectedId(item.id);
                        if (type === 'step' && onSelectStep) {
                            onSelectStep(item.id, e.shiftKey || e.metaKey, true);
                        } else if (onSelectSegment) {
                            onSelectSegment(item.id, true);
                        }
                    }

                    // 2. Playback control
                    if (videoRef.current) videoRef.current.pause();
                    
                    // 3. Prepare Movement (but don't capture pointer yet)
                    handleItemMove(item, onUpdate)(e);
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    // Final fallback to ensure selection happens on click completion
                    if (localSelectedId !== item.id) {
                        setLocalSelectedId(item.id);
                        if (type === 'step' && onSelectStep) {
                            onSelectStep(item.id, e.shiftKey || e.metaKey, true);
                        } else if (onSelectSegment) {
                            onSelectSegment(item.id, true);
                        }
                    }
                }}
            >
                <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-foreground/10 dark:bg-white/20 rounded-t-[3px] z-10" />
                {isSelected && <div className="absolute top-0 left-0 right-0 h-[1px] bg-foreground/20 dark:bg-white/40 rounded-t-[3px] z-20" />}
                
                <div 
                    className={cn(
                        "absolute left-[-2px] inset-y-[-2px] w-3 cursor-ew-resize z-30 flex items-center justify-center",
                        isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}
                    onPointerDown={handleItemResize(item, 'start', onUpdate)}
                >
                    <div className={cn("w-full h-full rounded-l-[2px] flex items-center justify-center border-r border-black/5 shadow-sm", isSelected ? "bg-white" : "bg-white/40")}>
                        <div className={cn("w-[1.5px] h-3 rounded-full", isSelected ? "bg-black/40" : "bg-black/20")} />
                    </div>
                </div>
                
                <div className="flex flex-col justify-center px-4 pointer-events-none overflow-hidden w-full select-none">
                    <span className={cn("text-[10px] font-bold truncate tracking-tight", type === 'step' ? "text-white" : "text-foreground dark:text-white")}>
                        {item.text}
                    </span>
                    {item.description && (
                        <span className={cn("text-[8px] truncate leading-tight font-medium", type === 'step' ? "text-white/70" : "text-foreground/70 dark:text-white/70")}>
                            {item.description}
                        </span>
                    )}
                </div>

                <div 
                    className={cn(
                        "absolute right-[-2px] inset-y-[-2px] w-3 cursor-ew-resize z-30 flex items-center justify-center",
                        isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}
                    onPointerDown={handleItemResize(item, 'end', onUpdate)}
                >
                    <div className={cn("w-full h-full rounded-r-[2px] flex items-center justify-center border-l border-black/5 shadow-sm", isSelected ? "bg-white" : "bg-white/40")}>
                        <div className={cn("w-[1.5px] h-3 rounded-full", isSelected ? "bg-black/40" : "bg-black/20")} />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-background dark:bg-[#0f0f11] overflow-hidden border border-border dark:border-[#2a2a2e] select-none shadow-2xl">
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes ring-pulse {
                    0% { ring-offset-color: #0f0f11; ring-color: rgba(99, 102, 241, 0.2); }
                    50% { ring-offset-color: #0f0f11; ring-color: rgba(99, 102, 241, 0.7); }
                    100% { ring-offset-color: #0f0f11; ring-color: rgba(99, 102, 241, 0.2); }
                }
                .ring-pulse {
                    animation: ring-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
            `}} />
            <div className="h-14 border-b border-border dark:border-[#2a2a2e] bg-background dark:bg-[#0f0f11] flex items-center px-4 shrink-0 gap-4">
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground/50 hover:text-foreground hover:bg-secondary/50 disabled:opacity-30" onClick={() => onSplitStep?.()} disabled={selectedStepIds.size !== 1}>
                                    <SquareSplitHorizontal className="w-3.5 h-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[10px]">{selectedStepIds.size !== 1 ? t('selectStepToSplit') : t('splitAtPlayhead')}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground/50 hover:text-foreground hover:bg-secondary/50" onClick={() => onMergeSteps?.()} disabled={selectedStepIds.size < 2}>
                                    <Combine className="w-3.5 h-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[10px]">Combinar Pasos (IA)</TooltipContent>
                        </Tooltip>
                        <div className="w-px h-4 bg-border/80 mx-1 shrink-0" />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground/50 hover:text-foreground" onClick={() => { if (selectedSegmentId) onDeleteStep?.(selectedSegmentId); }} disabled={!selectedSegmentId}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[10px]">Borrar (Del)</TooltipContent>
                        </Tooltip>
                        <div className="w-px h-4 bg-border/80 mx-1 shrink-0" />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground/50 hover:text-foreground" onClick={() => onUndo?.()} disabled={!canUndo}>
                                    <Undo2 className="w-3.5 h-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[10px]">Deshacer (⌘Z)</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground/50 hover:text-foreground" onClick={() => onRedo?.()} disabled={!canRedo}>
                                    <Redo2 className="w-3.5 h-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[10px]">Rehacer (⌘⇧Z)</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                <div className="flex items-center gap-4 px-6">
                    <div className="flex items-center gap-3">
                        <button onClick={onTogglePlayback} className="w-9 h-9 flex items-center justify-center rounded-full bg-[#6366f1] text-white hover:scale-105 transition-all shadow-lg shadow-[#6366f1]/20 active:scale-95 shrink-0">
                            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                        </button>
                        <div className="flex items-center gap-1 font-mono text-[11px] tabular-nums whitespace-nowrap">
                            <span className="text-foreground dark:text-white font-semibold">{formatVideoTime(currentTimeSec).split('.')[0]}</span>
                            <span className="text-foreground/20 dark:text-white/20">/</span>
                            <span className="text-foreground-muted dark:text-white/40">{formatVideoTime(durationSec).split('.')[0]}</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex items-center justify-end gap-4 min-w-0">
                    <div className="flex items-center gap-1 group shrink-0">
                        <button onClick={() => setPixelsPerSecond(prev => Math.max(20, prev - 20))} disabled={pixelsPerSecond <= 20} className="text-foreground/40 hover:text-foreground p-1 transition-opacity disabled:opacity-10">
                            <Minus className="w-3 h-3" />
                        </button>
                        <div className="w-14 sm:w-20 relative flex items-center mx-1">
                            <Slider min={20} max={500} step={1} value={[pixelsPerSecond]} onValueChange={(val) => setPixelsPerSecond(val[0])} className="cursor-pointer" />
                        </div>
                        <button onClick={() => setPixelsPerSecond(prev => Math.min(500, prev + 20))} disabled={pixelsPerSecond >= 500} className="text-foreground/40 hover:text-foreground p-1 transition-opacity disabled:opacity-10">
                            <Plus className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="w-px h-4 bg-border/80 shrink-0" />
                    <div className="flex items-center gap-1">
                        <div className="relative flex items-center group/volume h-8">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground/40 hover:text-foreground shrink-0 rounded-md" onClick={() => onVolumeChange?.(volume > 0 ? 0 : lastVolume)}>
                                {volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                            </Button>
                            <div className="absolute left-full ml-1 top-1/2 -translate-y-1/2 w-0 overflow-hidden group-hover/volume:w-24 transition-all duration-300 ease-in-out flex items-center bg-background/95 backdrop-blur rounded-md shadow-sm h-8 px-0 group-hover/volume:px-2 z-50 border border-transparent group-hover/volume:border-border">
                                <Slider min={0} max={1} step={0.01} value={[volume]} onValueChange={(val) => onVolumeChange?.(val[0])} className="w-20 cursor-pointer" />
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className={cn("h-8 w-8 transition-colors shrink-0 rounded-md", showSubtitles ? "text-accent-blue bg-accent-blue/10" : "text-foreground/40 dark:text-white/30 hover:text-foreground dark:hover:text-white")} onClick={onToggleSubtitles}>
                            <Captions className="w-3.5 h-3.5" />
                        </Button>
                        <div className="w-px h-4 bg-border/80 dark:bg-white/10 shrink-0" />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 px-2 text-[10px] font-bold text-foreground/40 dark:text-white/30 hover:text-foreground dark:hover:text-white gap-1 hover:bg-secondary/50">
                                    {playbackRate}x <ChevronDown className="w-3 h-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-background dark:bg-[#1a1a1a] border-border dark:border-white/10">
                                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                                    <DropdownMenuItem key={rate} onClick={() => onPlaybackRateChange?.(rate)} className="text-[11px] font-medium">
                                        {rate}x {playbackRate === rate && <Check className="ml-2 w-3 h-3 text-accent-blue" />}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
            <div ref={containerRef} className="flex-1 overflow-auto scroll-smooth relative custom-scrollbar bg-background dark:bg-[#0f0f11]" onScroll={handleScroll}>
                <div className="flex relative" style={{ width: `${timelineWidth + sidebarWidth}px` }}>
                    <div className="sticky left-0 w-[280px] z-[70] bg-background dark:bg-[#0f0f11] border-r border-border dark:border-[#2a2a2e] flex flex-col shadow-2xl shrink-0">
                         <div className="flex flex-col py-0 flex-1 overflow-visible">
                             <div className="h-10 shrink-0 border-b border-border dark:border-[#2d2d30] bg-background-secondary/80 dark:bg-[#1a1a1e]" />
                             <div className="h-12 flex items-center px-4 shrink-0 bg-background-secondary dark:bg-[#252529] border-b border-border dark:border-[#2d2d30] relative">
                                 <span className="text-[11px] font-bold text-foreground dark:text-white truncate uppercase tracking-[0.1em]">Transcripción</span>
                             </div>
                             <div className="h-8 flex items-center px-4 shrink-0 bg-background dark:bg-[#0f0f11] border-b border-border dark:border-[#2a2a2e]/50">
                                 <span className="text-[9px] font-bold text-foreground-muted dark:text-white/40 uppercase tracking-[0.2em]">Steps</span>
                             </div>
                             <DndContext 
                                 sensors={sensors} 
                                 collisionDetection={closestCenter} 
                                 onDragStart={() => {
                                     if (videoRef.current) videoRef.current.pause();
                                 }}
                                 onDragEnd={handleDragEndSidebar} 
                                 modifiers={[restrictToVerticalAxis]}
                             >
                                 <SortableContext items={steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
                                     {steps.map((step, index) => (
                                         <SortableStepItem key={step.id} step={step} index={index} selectedStepIds={selectedStepIds} selectedSegmentId={selectedSegmentId} videoRef={videoRef} onSelectStep={onSelectStep} />
                                     ))}
                                 </SortableContext>
                             </DndContext>
                         </div>
                    </div>
                    <div ref={trackRef} className="flex-1 relative min-h-full" onClick={handleTrackClick}>
                        <div className="h-10 border-b border-border dark:border-[#2d2d30] sticky top-0 bg-background/95 dark:bg-[#09090b] backdrop-blur-sm z-40">
                            <div className="relative h-full">
                                {ticks.map((tick) => (
                                    <div key={tick.sec} className={cn("absolute top-0 h-full border-l", tick.isMajor ? "border-foreground/40 dark:border-white/40 w-[1.5px]" : "border-foreground/20 dark:border-white/20 h-1.5 mt-auto")} style={{ left: `${tick.x}px` }}>
                                        {tick.isMajor && (
                                            <span className="text-[10px] text-foreground-muted/80 dark:text-white/60 -translate-x-1/2 ml-[-1px] mb-1 absolute bottom-1.5 leading-none font-bold tracking-tight">
                                                {formatVideoTime(tick.sec).split('.')[0]}s
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-col px-0 relative min-h-[160px]">
                            <div className="h-12 relative border-b border-border dark:border-[#2d2d30] bg-background-secondary/80 dark:bg-[#1a1a1e] group transition-colors">
                                {segments.map((segment) => renderTimelineItem(segment, 'subtitle', onUpdateSegment))}
                            </div>
                            <div className="h-8 bg-background-secondary/30 dark:bg-[#09090b] border-b border-border dark:border-[#2d2d30] relative" />
                            {steps.map((step) => {
                                return (
                                    <div key={step.id} className={cn("h-12 relative border-b border-border dark:border-[#2d2d30] group hover:bg-foreground/5 dark:hover:bg-white/[0.04] transition-colors z-20", steps.findIndex(s => s.id === step.id) % 2 === 0 ? "bg-background dark:bg-[#111114]" : "bg-background-secondary/80 dark:bg-[#1a1a1e]")}>
                                        {renderTimelineItem(step, 'step', onUpdateStep || onUpdateSegment)}
                                    </div>
                                );
                            })}
                            <div className="h-20 mt-6 relative bg-foreground/[0.02] dark:bg-white/[0.02] border-y border-border dark:border-[#2a2a2e] flex items-center overflow-hidden">
                                 <div className="flex gap-1 h-full opacity-20 dark:opacity-20">
                                    {Array.from({ length: Math.min(Math.ceil(timelineWidth / 120), 300) }).map((_, i) => (
                                        <div key={i} className="w-[116px] h-full bg-foreground/5 dark:bg-white/5 shrink-0 border-r border-border dark:border-[#2a2a2e]" />
                                    ))}
                                 </div>
                            </div>
                        </div>
                        <div ref={playheadRef} className="absolute top-0 bottom-0 left-0 w-[1.5px] z-[60] pointer-events-none will-change-transform">
                            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center">
                                <div className="relative z-[70] top-0 flex-none">
                                    <Triangle className="w-[12px] h-[12px] fill-foreground dark:fill-white text-foreground dark:text-white rotate-180 drop-shadow-[0_0_8px_rgba(0,0,0,0.2)] dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
                                </div>
                                <div className="w-[1.5px] flex-1 bg-foreground dark:bg-white shadow-[0_0_10px_rgba(0,0,0,0.1)] dark:shadow-[0_0_10px_rgba(255,255,255,0.3)] -mt-[0.5px]" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
