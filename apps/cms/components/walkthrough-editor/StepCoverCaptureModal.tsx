'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LumenVideoPlayer } from '@/components/shared/video/LumenVideoPlayer';
import { LumenTimeline } from '@/components/shared/video/LumenTimeline';
import { CapcutTimeline } from '@/components/project-detail/CapcutTimeline';
import { useGenerateStepGif } from '@luma/infra';
import { toast } from 'sonner';
import { Film, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatTime(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00.0';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds - Math.floor(seconds)) * 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${ms}`;
}

export interface StepCoverCaptureModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    walkthroughId: string;
    stepId: string;
    stepTitle?: string;
    videoUrl: string | null;
    startMs: number;
    endMs: number;
    videoDurationMs?: number | null;
    onSuccess: (gifUrl: string, startMs: number, endMs: number) => void;
}

export function StepCoverCaptureModal({
    open,
    onOpenChange,
    walkthroughId,
    stepId,
    stepTitle,
    videoUrl,
    startMs: initialStartMs,
    endMs: initialEndMs,
    videoDurationMs,
    onSuccess,
}: StepCoverCaptureModalProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);

    // Video player state
    const [isVideoLoading, setIsVideoLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [videoDuration, setVideoDuration] = useState<number>(
        videoDurationMs ? videoDurationMs / 1000 : 0
    );
    const [playbackRate, setPlaybackRate] = useState(1);
    const [showSubtitles, setShowSubtitles] = useState(false);
    const [volume, setVolume] = useState(1);
    const [lastVolume, setLastVolume] = useState(1);

    // The single step item fed to CapcutTimeline — user edits startMs/endMs by dragging
    const [stepItem, setStepItem] = useState({
        id: stepId,
        order: 1,
        startMs: initialStartMs,
        endMs: initialEndMs,
        text: stepTitle || 'Step',
        description: 'Capture window',
    });

    const generateStepGif = useGenerateStepGif();

    // Reset + seek to step start when the modal opens
    useEffect(() => {
        if (open) {
            const freshItem = {
                id: stepId,
                order: 1,
                startMs: initialStartMs,
                endMs: initialEndMs,
                text: stepTitle || 'Step',
                description: 'Capture window',
            };
            setStepItem(freshItem);
            setIsPlaying(false);
            const t = setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.currentTime = initialStartMs / 1000;
                    setCurrentTime(initialStartMs / 1000);
                }
            }, 120);
            return () => clearTimeout(t);
        }
    }, [open, stepId, stepTitle, initialStartMs, initialEndMs]);

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

    // Called by CapcutTimeline when the user drags/resizes the step block
    const handleUpdateStep = useCallback(
        (id: string, patch: Partial<{ startMs: number; endMs: number; text: string }>) => {
            setStepItem((prev) => ({ ...prev, ...patch }));
            // Seek video to the new startMs so the user sees what they captured
            if (patch.startMs != null && videoRef.current) {
                videoRef.current.currentTime = patch.startMs / 1000;
            }
        },
        []
    );

    const handleCapture = async () => {
        try {
            const result = await generateStepGif.mutateAsync({
                walkthroughId,
                stepId,
                startMs: stepItem.startMs,
                endMs: stepItem.endMs,
            });
            toast.success('Cover captured!');
            onSuccess(result.gifUrl, result.startMs, result.endMs);
            onOpenChange(false);
        } catch (err: any) {
            toast.error('Failed to capture cover', {
                description: err?.message || 'Something went wrong.',
            });
        }
    };

    const durationSec = videoDuration || (videoDurationMs ? videoDurationMs / 1000 : 1);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-5xl p-0 gap-0 overflow-hidden bg-background dark:bg-[#111114] border-border"
                onPointerDownOutside={(e) => {
                    if (generateStepGif.isPending) e.preventDefault();
                }}
            >
                {/* Header */}
                <DialogHeader className="px-6 pt-5 pb-4 border-b border-border bg-background-secondary/40 dark:bg-[#09090b]">
                    <DialogTitle className="flex items-center gap-2 text-sm font-bold">
                        <Film className="h-4 w-4 text-accent-blue" />
                        Capture Cover from Video
                        {stepTitle && (
                            <span className="text-foreground-muted font-normal ml-1">
                                — {stepTitle}
                            </span>
                        )}
                    </DialogTitle>
                </DialogHeader>

                {/* Body */}
                <div className="flex flex-col overflow-hidden" style={{ maxHeight: 'calc(90vh - 140px)' }}>
                    {/* Video player — hideControls because CapcutTimeline has its own transport */}
                    <div className="shrink-0">
                        <LumenVideoPlayer
                            ref={videoRef}
                            videoUrl={videoUrl}
                            isVideoLoading={isVideoLoading}
                            isPlaying={isPlaying}
                            currentTime={currentTime}
                            durationSec={durationSec}
                            playbackRate={playbackRate}
                            showSubtitles={showSubtitles}
                            subtitleSegments={[]}
                            activeSegment={null}
                            onTogglePlayback={togglePlayback}
                            onToggleSubtitles={() => setShowSubtitles((v) => !v)}
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
                            volume={volume}
                            lastVolume={lastVolume}
                            onVolumeChange={(val) => {
                                if (val > 0) setLastVolume(val);
                                setVolume(val);
                            }}
                            hideControls
                            renderTimeline={() => (
                                <LumenTimeline
                                    durationSec={durationSec}
                                    currentTime={currentTime}
                                    progressPercent={(currentTime / durationSec) * 100}
                                    reviewSteps={[
                                        { id: stepItem.id, timestampMs: stepItem.startMs },
                                    ]}
                                    activeStepId={stepItem.id}
                                    onSeek={handleSeek}
                                    onScrub={handleSeek}
                                />
                            )}
                            formatTime={formatTime}
                        />
                    </div>

                    {/* CapcutTimeline — exact same component as Lumen Review, with a single step */}
                    <div className="h-[320px] shrink-0">
                        <CapcutTimeline
                            durationSec={durationSec}
                            currentTimeSec={currentTime}
                            segments={[]}
                            steps={[stepItem]}
                            selectedSegmentId={stepItem.id}
                            initialPixelsPerSecond={20}
                            onSeek={handleSeek}
                            onUpdateSegment={() => undefined}
                            onSelectSegment={() => undefined}
                            onUpdateStep={handleUpdateStep}
                            videoRef={videoRef}
                            isPlaying={isPlaying}
                            onTogglePlayback={togglePlayback}
                            playbackRate={playbackRate}
                            onPlaybackRateChange={setPlaybackRate}
                            showSubtitles={showSubtitles}
                            onToggleSubtitles={() => setShowSubtitles((v) => !v)}
                            volume={volume}
                            lastVolume={lastVolume}
                            onVolumeChange={(val) => {
                                if (val > 0) setLastVolume(val);
                                setVolume(val);
                            }}
                            selectedStepIds={new Set([stepItem.id])}
                            onSelectStep={() => undefined}
                            canUndo={false}
                            canRedo={false}
                        />
                    </div>
                </div>

                {/* Footer */}
                <DialogFooter className="px-6 py-4 border-t border-border bg-background-secondary/30 dark:bg-[#09090b]">
                    <div className="flex items-center gap-2 text-[11px] text-foreground-muted mr-auto font-mono">
                        <span className="opacity-60">Window:</span>
                        {formatTime(stepItem.startMs / 1000)}
                        <span className="opacity-40">→</span>
                        {formatTime(stepItem.endMs / 1000)}
                        <span className="opacity-50 ml-1">
                            ({((stepItem.endMs - stepItem.startMs) / 1000).toFixed(1)}s)
                        </span>
                    </div>
                    <Button
                        variant="outline"
                        className="text-xs"
                        onClick={() => onOpenChange(false)}
                        disabled={generateStepGif.isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCapture}
                        disabled={
                            generateStepGif.isPending ||
                            !videoUrl ||
                            stepItem.endMs <= stepItem.startMs
                        }
                        className={cn(
                            'gap-2 text-xs font-bold',
                            'bg-accent-blue hover:bg-accent-blue/90 text-white'
                        )}
                    >
                        {generateStepGif.isPending ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Generating GIF…
                            </>
                        ) : (
                            <>
                                <Film className="h-3.5 w-3.5" />
                                Capture GIF
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
