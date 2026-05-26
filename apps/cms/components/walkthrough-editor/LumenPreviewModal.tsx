'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    ResizablePanelGroup,
    ResizablePanel,
    ResizableHandle,
} from '@/components/ui/resizable';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LumenVideoPlayer } from '@/components/shared/video/LumenVideoPlayer';
import { LumenTimeline } from '@/components/shared/video/LumenTimeline';
import { CapcutTimeline } from '@/components/project-detail/CapcutTimeline';
import { useLumenReview } from '@luma/infra';
import {
    Loader2,
    Video,
    MousePointer2,
    Hand,
    ChevronDown,
    ZoomIn,
    ZoomOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function formatTime(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00.0';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds - Math.floor(seconds)) * 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${ms}`;
}

export interface LumenPreviewModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    lumenId: string | null;
    lumenTitle?: string;
}

export function LumenPreviewModal({
    open,
    onOpenChange,
    lumenId,
    lumenTitle,
}: LumenPreviewModalProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const timelinePanelRef = useRef<ImperativePanelHandle>(null);

    const { data, isLoading } = useLumenReview(lumenId ?? undefined);

    const videoUrl = data?.videoUrl ?? null;
    const videoDurationMs = data?.session?.videoDurationMs ?? null;

    // Convert step candidates → CapcutTimeline format
    const steps = useMemo(() => {
        const candidates = data?.stepCandidates ?? [];
        return candidates.map((c, i) => {
            const nextTs =
                candidates[i + 1]?.timestampMs ?? videoDurationMs ?? c.timestampMs + 5000;
            return {
                id: c.id,
                order: c.order,
                startMs: c.timestampMs,
                endMs: nextTs,
                text: c.title,
                description: c.description,
            };
        });
    }, [data, videoDurationMs]);

    // Video player state
    const [isVideoLoading, setIsVideoLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [videoDuration, setVideoDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [showSubtitles, setShowSubtitles] = useState(true);
    const [volume, setVolume] = useState(1);
    const [lastVolume, setLastVolume] = useState(1);
    const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

    // Canvas zoom + pan
    const [zoom, setZoom] = useState(75);
    const [isPanning, setIsPanning] = useState(false);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // Timeline panel toggle
    const [isTimelineCollapsed, setIsTimelineCollapsed] = useState(false);

    // Extract subtitle segments from processingSummary (same logic as LumenReviewPanel)
    const subtitleSegments = useMemo(() => {
        const raw = data?.session?.processingSummary?.transcript as Record<string, any> | undefined;
        const segments = Array.isArray(raw?.segments) ? (raw.segments as Array<Record<string, any>>) : [];
        return segments
            .map((seg, i) => {
                const startMs = Number(seg.startMs ?? seg.start ?? 0);
                const endMs = Number(seg.endMs ?? seg.end ?? startMs);
                const text = String(seg.text || '').replace(/\s+/g, ' ').trim();
                return {
                    id: `sub-${i + 1}`,
                    order: i + 1,
                    startMs: Number.isFinite(startMs) ? Math.max(0, startMs) : 0,
                    endMs: Number.isFinite(endMs) ? Math.max(0, endMs) : 0,
                    text,
                };
            })
            .filter((s) => s.text && s.endMs >= s.startMs)
            .sort((a, b) => a.startMs - b.startMs);
    }, [data]);

    // Active subtitle segment tracked by playhead
    const activeSegment = useMemo(() => {
        const timeMs = currentTime * 1000;
        return subtitleSegments.find((s) => timeMs >= s.startMs && timeMs <= s.endMs) ?? null;
    }, [subtitleSegments, currentTime]);

    // Reset on open / lumen change
    useEffect(() => {
        if (open) {
            setIsPlaying(false);
            setCurrentTime(0);
            setSelectedStepId(null);
            setIsVideoLoading(true);
            setZoom(75);
            setPanOffset({ x: 0, y: 0 });
            setIsPanning(false);
            setTimeout(() => {
                if (videoRef.current) videoRef.current.currentTime = 0;
            }, 120);
        }
    }, [open, lumenId]);

    const durationSec = useMemo(() => {
        if (videoDuration > 0) return videoDuration;
        if (videoDurationMs) return videoDurationMs / 1000;
        const maxStep = steps.reduce((m, s) => Math.max(m, s.endMs), 0);
        return maxStep ? maxStep / 1000 : 1;
    }, [videoDuration, videoDurationMs, steps]);

    const togglePlayback = useCallback(() => {
        if (!videoRef.current) return;
        if (videoRef.current.paused) {
            videoRef.current.play().catch(() => undefined);
        } else {
            videoRef.current.pause();
        }
    }, []);

    const handleSeek = useCallback((sec: number) => {
        if (videoRef.current) videoRef.current.currentTime = sec;
        setCurrentTime(sec);
    }, []);

    // Pan handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isPanning) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    };
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !isPanning) return;
        setPanOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    };
    const handleMouseUp = () => setIsDragging(false);

    // Auto-track active step from playhead
    useEffect(() => {
        if (!steps.length) return;
        const timeMs = currentTime * 1000;
        const active = steps.find((s) => timeMs >= s.startMs && timeMs < s.endMs);
        if (active && active.id !== selectedStepId) setSelectedStepId(active.id);
    }, [currentTime, steps]);

    // Keyboard shortcuts
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.key === ' ') { e.preventDefault(); togglePlayback(); }
            if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
                e.preventDefault(); setZoom(v => Math.min(400, v + 25));
            }
            if ((e.metaKey || e.ctrlKey) && e.key === '-') {
                e.preventDefault(); setZoom(v => Math.max(25, v - 25));
            }
            if (e.shiftKey && e.key === 'F') { e.preventDefault(); setZoom(75); setPanOffset({ x: 0, y: 0 }); }
        };
        window.addEventListener('keydown', onKey, { capture: true });
        return () => window.removeEventListener('keydown', onKey, { capture: true });
    }, [open, togglePlayback]);

    const title = lumenTitle || data?.session?.intent || 'Recording preview';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* style overrides Tailwind's `grid` from the shadcn base so flex children fill h-[90vh] correctly */}
            <DialogContent
                className="max-w-6xl h-[90vh] p-0 gap-0 overflow-hidden bg-background dark:bg-[#0f0f11] border-border"
                style={{ display: 'flex', flexDirection: 'column' }}
            >
                {/* Header — 3-column layout: title | centered toolbar | spacer (mirrors title width for true centering) */}
                {/* pr-12 reserves space for shadcn's absolute X close button */}
                <div className="shrink-0 h-12 pl-4 pr-12 border-b border-border dark:border-[#2a2a2e] bg-background-secondary/40 dark:bg-[#09090b] flex items-center w-full">
                    {/* Left: title */}
                    <DialogTitle className="flex items-center gap-2 text-sm font-bold min-w-0 flex-1">
                        <Video className="h-4 w-4 text-accent-blue shrink-0" />
                        <span className="truncate max-w-xs">{title}</span>
                    </DialogTitle>

                    {/* Center: zoom + pan toolbar */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        {/* Mouse / Hand toggle */}
                        <div className="flex items-center gap-0.5 bg-background-secondary dark:bg-[#141417] border border-border/60 rounded-full px-1 py-1 shadow-sm">
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    'h-6 w-6 rounded-full transition-colors',
                                    !isPanning
                                        ? 'bg-background dark:bg-[#2a2a2e] text-foreground shadow-sm ring-1 ring-border/50'
                                        : 'text-foreground-muted hover:text-foreground'
                                )}
                                onClick={() => setIsPanning(false)}
                                title="Select (V)"
                            >
                                <MousePointer2 className="h-3 w-3" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    'h-6 w-6 rounded-full transition-colors',
                                    isPanning
                                        ? 'bg-background dark:bg-[#2a2a2e] text-foreground shadow-sm ring-1 ring-border/50'
                                        : 'text-foreground-muted hover:text-foreground'
                                )}
                                onClick={() => setIsPanning(true)}
                                title="Pan (H)"
                            >
                                <Hand className="h-3 w-3" />
                            </Button>
                            <div className="w-px h-3 bg-border/40 mx-0.5" />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-full text-foreground-muted hover:text-foreground"
                                onClick={() => setZoom(v => Math.max(25, v - 25))}
                                title="Zoom out (⌘-)"
                            >
                                <ZoomOut className="h-3 w-3" />
                            </Button>
                            {/* Zoom dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-1.5 rounded-full text-[10px] font-bold gap-0.5 text-foreground/70 hover:text-foreground hover:bg-foreground/5 min-w-[44px]"
                                    >
                                        {zoom}%
                                        <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="center" className="w-56 p-3 space-y-3">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-foreground-muted uppercase tracking-wider">Zoom</span>
                                            <span className="text-xs font-mono bg-background-secondary px-1.5 py-0.5 rounded">{zoom}%</span>
                                        </div>
                                        <Slider
                                            value={[zoom]}
                                            min={25}
                                            max={400}
                                            step={1}
                                            onValueChange={([v]) => setZoom(v)}
                                        />
                                    </div>
                                    <DropdownMenuSeparator />
                                    <div className="space-y-0.5">
                                        <DropdownMenuItem onClick={() => { setZoom(75); setPanOffset({ x: 0, y: 0 }); }} className="text-xs cursor-pointer justify-between">
                                            Fit <span className="text-[10px] opacity-50">⇧ F</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setZoom(50)} className="text-xs cursor-pointer justify-between">
                                            50% <span className="text-[10px] opacity-50" />
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setZoom(100)} className="text-xs cursor-pointer justify-between">
                                            100% <span className="text-[10px] opacity-50">⇧ 1</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setZoom(200)} className="text-xs cursor-pointer justify-between">
                                            200% <span className="text-[10px] opacity-50">⇧ 2</span>
                                        </DropdownMenuItem>
                                    </div>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-full text-foreground-muted hover:text-foreground"
                                onClick={() => setZoom(v => Math.min(400, v + 25))}
                                title="Zoom in (⌘+)"
                            >
                                <ZoomIn className="h-3 w-3" />
                            </Button>
                        </div>

                    </div>

                    {/* Right: spacer mirrors title width so toolbar stays truly centered */}
                    <div className="flex-1" />
                </div>{/* end header */}

                {/* Body */}
                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center w-full text-foreground-muted">
                        <Loader2 className="h-6 w-6 animate-spin opacity-40" />
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 w-full overflow-hidden">
                        <ResizablePanelGroup direction="vertical" className="h-full w-full">

                            {/* ── Video stage ── */}
                            <ResizablePanel defaultSize={60} minSize={30}>
                                <div
                                    ref={canvasRef}
                                    className={cn(
                                        'relative w-full h-full bg-background-secondary/30 dark:bg-[#18181c] overflow-hidden',
                                        isPanning ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
                                    )}
                                    onMouseDown={handleMouseDown}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUp}
                                    onMouseLeave={handleMouseUp}
                                >
                                    {/* Ambient light */}
                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.03)_0%,_transparent_80%)] pointer-events-none opacity-40" />

                                    {/* Centering layer — fills the canvas, centers the video */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                    {/* Video stage — aspect-video, zoom + pan via transform */}
                                    <div
                                        className="w-[90%] max-w-5xl aspect-video bg-black shadow-[0_30px_60px_rgba(0,0,0,0.4)] border border-white/5 z-10 transition-transform duration-200 ease-out will-change-transform"
                                        style={{
                                            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom / 100})`,
                                        }}
                                    >
                                        <LumenVideoPlayer
                                            ref={videoRef}
                                            videoUrl={videoUrl}
                                            isVideoLoading={isVideoLoading}
                                            isPlaying={isPlaying}
                                            currentTime={currentTime}
                                            durationSec={durationSec}
                                            playbackRate={playbackRate}
                                            showSubtitles={showSubtitles}
                                            subtitleSegments={subtitleSegments}
                                            activeSegment={activeSegment}
                                            onTogglePlayback={togglePlayback}
                                            onToggleSubtitles={() => setShowSubtitles(v => !v)}
                                            onPlaybackRateChange={setPlaybackRate}
                                            onTimeUpdate={setCurrentTime}
                                            onLoadedMetadata={(dur) => {
                                                setVideoDuration(dur);
                                                setIsVideoLoading(false);
                                            }}
                                            onLoadedData={() => setIsVideoLoading(false)}
                                            onCanPlay={() => setIsVideoLoading(false)}
                                            onPlay={() => setIsPlaying(true)}
                                            onPause={() => setIsPlaying(false)}
                                            onEnded={(t) => { setIsPlaying(false); if (t > 0) setVideoDuration(t); }}
                                            volume={volume}
                                            lastVolume={lastVolume}
                                            onVolumeChange={(val) => { if (val > 0) setLastVolume(val); setVolume(val); }}
                                            hideControls
                                            renderTimeline={() => (
                                                <LumenTimeline
                                                    durationSec={durationSec}
                                                    currentTime={currentTime}
                                                    progressPercent={(currentTime / durationSec) * 100}
                                                    reviewSteps={steps.map(s => ({ id: s.id, timestampMs: s.startMs }))}
                                                    activeStepId={selectedStepId}
                                                    onSeek={handleSeek}
                                                    onScrub={handleSeek}
                                                />
                                            )}
                                            formatTime={formatTime}
                                        />
                                    </div>{/* video stage inner */}
                                    </div>{/* centering layer */}
                                </div>{/* canvas */}
                            </ResizablePanel>

                            <ResizableHandle className="h-[3px] bg-border/40 hover:bg-accent-blue/40 transition-colors" />

                            {/* ── Timeline panel (collapsible) ── */}
                            <ResizablePanel
                                ref={timelinePanelRef}
                                defaultSize={40}
                                minSize={20}
                                collapsible
                                collapsedSize={0}
                                onCollapse={() => setIsTimelineCollapsed(true)}
                                onExpand={() => setIsTimelineCollapsed(false)}
                            >
                                <div className="h-full overflow-hidden">
                                    <CapcutTimeline
                                        durationSec={durationSec}
                                        currentTimeSec={currentTime}
                                        segments={[]}
                                        steps={steps}
                                        selectedSegmentId={selectedStepId}
                                        initialPixelsPerSecond={20}
                                        onSeek={handleSeek}
                                        onUpdateSegment={() => undefined}
                                        onSelectSegment={() => undefined}
                                        onUpdateStep={() => undefined}
                                        videoRef={videoRef}
                                        isPlaying={isPlaying}
                                        onTogglePlayback={togglePlayback}
                                        playbackRate={playbackRate}
                                        onPlaybackRateChange={setPlaybackRate}
                                        showSubtitles={false}
                                        onToggleSubtitles={() => undefined}
                                        volume={volume}
                                        lastVolume={lastVolume}
                                        onVolumeChange={(val) => { if (val > 0) setLastVolume(val); setVolume(val); }}
                                        selectedStepIds={selectedStepId ? new Set([selectedStepId]) : new Set()}
                                        onSelectStep={(id) => {
                                            setSelectedStepId(id);
                                            const step = steps.find(s => s.id === id);
                                            if (step && videoRef.current) {
                                                videoRef.current.currentTime = step.startMs / 1000;
                                            }
                                        }}
                                        canUndo={false}
                                        canRedo={false}
                                        onToggleTimeline={() => {
                                            if (isTimelineCollapsed) {
                                                timelinePanelRef.current?.expand();
                                            } else {
                                                timelinePanelRef.current?.collapse();
                                            }
                                        }}
                                        timelineVisible={!isTimelineCollapsed}
                                    />
                                </div>
                            </ResizablePanel>

                        </ResizablePanelGroup>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
