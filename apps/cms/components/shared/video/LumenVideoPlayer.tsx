'use client';

import React, { forwardRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    Captions, 
    Pause, 
    Play, 
    Settings2,
    Loader2,
    Volume2,
    VolumeX
} from 'lucide-react';
import { LumenSubtitleOverlay } from './LumenSubtitleOverlay';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface LumenVideoPlayerProps {
    videoUrl: string | null;
    isVideoLoading: boolean;
    isPlaying: boolean;
    currentTime: number;
    durationSec: number;
    playbackRate: number;
    showSubtitles: boolean;
    subtitleSegments: any[];
    activeSegment: any;
    onTogglePlayback: () => void;
    onToggleSubtitles: () => void;
    onPlaybackRateChange: (rate: number) => void;
    onTimeUpdate: (time: number) => void;
    onLoadedMetadata: (duration: number) => void;
    onLoadedData: () => void;
    onCanPlay: () => void;
    onPlay: () => void;
    onPause: () => void;
    onEnded?: (finalTime: number) => void;
    renderTimeline: () => React.ReactNode;
    formatTime: (seconds: number) => string;
    hideControls?: boolean;
    volume?: number;
    lastVolume?: number;
    onVolumeChange?: (val: number) => void;
}

export const LumenVideoPlayer = forwardRef<HTMLVideoElement, LumenVideoPlayerProps>(({
    videoUrl,
    isVideoLoading,
    isPlaying,
    currentTime,
    durationSec,
    playbackRate,
    showSubtitles,
    subtitleSegments,
    activeSegment,
    onTogglePlayback,
    onToggleSubtitles,
    onPlaybackRateChange,
    onTimeUpdate,
    onLoadedMetadata,
    onLoadedData,
    onCanPlay,
    onPlay,
    onPause,
    onEnded,
    renderTimeline,
    formatTime,
    hideControls = false,
    volume = 1,
    lastVolume = 1,
    onVolumeChange
}, ref) => {
    const [isBuffering, setIsBuffering] = useState(false);
    const [subtitleAlign, setSubtitleAlign] = useState<'left' | 'center'>('center');
    const [isVolumeHovered, setIsVolumeHovered] = useState(false);
    
    const internalVideoRef = React.useRef<HTMLVideoElement | null>(null);
    const setRefs = React.useCallback((element: HTMLVideoElement | null) => {
        internalVideoRef.current = element;
        if (typeof ref === 'function') {
            ref(element);
        } else if (ref) {
            ref.current = element;
        }
    }, [ref]);

    React.useEffect(() => {
        if (internalVideoRef.current) {
            internalVideoRef.current.playbackRate = playbackRate;
        }
    }, [playbackRate, videoUrl]);

    React.useEffect(() => {
        if (internalVideoRef.current) {
            internalVideoRef.current.volume = volume;
            internalVideoRef.current.muted = volume === 0;
        }
    }, [volume]);

    const VIDEO_STAGE_HEIGHT_CLASS = 'aspect-video w-full';

    return (
        <div className="flex flex-col w-full bg-background overflow-hidden relative border border-border rounded-lg shadow-2xl">
            {!videoUrl ? (
                <div className={`${VIDEO_STAGE_HEIGHT_CLASS} w-full bg-background-secondary overflow-hidden`}>
                    <Skeleton className="h-full w-full rounded-none" />
                </div>
            ) : (
                <>
                    <div className={`${VIDEO_STAGE_HEIGHT_CLASS} relative w-full bg-black group`}>
                        {isVideoLoading && (
                            <div className="absolute inset-0 z-10 pointer-events-none">
                                <Skeleton className="h-full w-full rounded-none" />
                            </div>
                        )}
                        {/* Buffering Indicator */}
                        {isBuffering && !isVideoLoading && (
                            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none bg-black/20 backdrop-blur-[1px]">
                                <Loader2 className="h-12 w-12 text-white/80 animate-spin drop-shadow-lg" />
                            </div>
                        )}

                        <video
                            ref={setRefs}
                            src={videoUrl}
                            preload="metadata"
                            playsInline
                            className={`h-full w-full object-contain bg-black transition-opacity duration-200 ${isVideoLoading ? 'opacity-0' : 'opacity-100'}`}
                            onVolumeChange={(e) => {
                                const target = e.currentTarget as HTMLVideoElement;
                                onVolumeChange?.(target.muted ? 0 : target.volume);
                            }}
                            onTimeUpdate={(e) => onTimeUpdate((e.currentTarget as HTMLVideoElement).currentTime)}
                            onLoadedMetadata={(e) => {
                                const duration = (e.currentTarget as HTMLVideoElement).duration;
                                if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
                                    onLoadedMetadata(duration);
                                }
                            }}
                            onLoadedData={onLoadedData}
                            onWaiting={() => setIsBuffering(true)}
                            onPlaying={() => {
                                setIsBuffering(false);
                                if (internalVideoRef.current) {
                                    internalVideoRef.current.playbackRate = playbackRate;
                                }
                                if (onPlay) onPlay();
                            }}
                            onCanPlay={() => {
                                setIsBuffering(false);
                                if (onCanPlay) onCanPlay();
                            }}
                            onSeeked={() => setIsBuffering(false)}
                            onEnded={(e) => {
                                setIsBuffering(false);
                                if (onEnded) onEnded((e.currentTarget as HTMLVideoElement).currentTime);
                            }}
                            onPlay={onPlay}
                            onPause={onPause}
                            onClick={onTogglePlayback}
                        />

                        {/* Floating Subtitles Overlay (Karaoke Style) */}
                        {showSubtitles && (
                            <LumenSubtitleOverlay 
                                currentTime={currentTime}
                                activeSegment={activeSegment}
                                align={subtitleAlign}
                            />
                        )}

                        {/* Floating CC Button (YouTube Style) */}
                        <div className="absolute bottom-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-40">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleSubtitles();
                                }}
                                className={cn(
                                    "h-8 px-3 rounded-full text-[11px] font-bold border backdrop-blur-md transition-all shadow-lg",
                                    showSubtitles 
                                        ? "bg-red-600 text-white border-red-500" 
                                        : "bg-background/60 text-foreground border-border/20 hover:bg-background/80"
                                )}
                            >
                                CC
                            </button>
                        </div>

                        {/* 1. Integrated Timeline (Absolute Bottom of Stage) */}
                        <div className="absolute bottom-0 left-0 right-0 z-50">
                            {renderTimeline()}
                        </div>
                    </div>

                    {/* 2. Control Bar Container (Below the video stage) */}
                    {!hideControls && (
                        <div className="w-full bg-background/95 backdrop-blur-2xl border-t border-border flex flex-col z-40 overflow-visible">
                            <div className="flex items-center justify-between px-3 py-2">
                                {/* Left Actions: Play, Volume & Time */}
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            className="text-foreground hover:text-red-500 transition-colors shrink-0"
                                            onClick={onTogglePlayback}
                                        >
                                            {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
                                        </button>
                                        
                                        <div 
                                            className="flex items-center gap-2 group/volume relative h-6"
                                            onMouseEnter={() => setIsVolumeHovered(true)}
                                            onMouseLeave={() => setIsVolumeHovered(false)}
                                        >
                                            <button
                                                type="button"
                                                className="text-foreground hover:text-red-500 transition-colors shrink-0"
                                                onClick={() => {
                                                    onVolumeChange?.(volume === 0 ? lastVolume : 0);
                                                }}
                                            >
                                                {volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                                            </button>
                                            <div className={cn(
                                                "w-0 overflow-hidden transition-all duration-300 ease-in-out opacity-0 flex items-center shrink-0 origin-left px-0",
                                                isVolumeHovered && "w-24 opacity-100 px-2"
                                            )}>
                                                <Slider 
                                                    min={0}
                                                    max={1}
                                                    step={0.01}
                                                    value={[volume]}
                                                    onValueChange={(val) => onVolumeChange?.(val[0])}
                                                    className="w-20 cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    </div>
    
                                    <div className="text-[13px] font-medium text-foreground tabular-nums border-l border-border pl-4">
                                        {formatTime(currentTime)} / {formatTime(durationSec)}
                                    </div>
                                </div>
    
                                {/* Right Actions: CC & Speed */}
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        className={cn(
                                            "transition-all hover:scale-110",
                                            showSubtitles ? "text-red-500" : "text-foreground"
                                        )}
                                        onClick={onToggleSubtitles}
                                        title="Toggle Captions (C)"
                                    >
                                        <Captions className="h-5 w-5" />
                                    </button>
    
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button className="text-foreground hover:rotate-45 transition-all duration-300">
                                                <Settings2 className="h-5 w-5" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-40 bg-popover backdrop-blur-xl border-border text-popover-foreground">
                                            <DropdownMenuLabel className="text-[10px] uppercase font-bold text-foreground/40 px-3 py-2">Playback Settings</DropdownMenuLabel>
                                            
                                            <DropdownMenuSeparator className="border-border" />
                                            <div className="px-3 py-2 text-[11px] font-bold text-foreground/60">Subtitles Alignment</div>
                                            <DropdownMenuItem
                                                onClick={() => setSubtitleAlign('left')}
                                                className={cn("text-[12px] flex items-center justify-between cursor-pointer py-2 pl-8 hover:bg-secondary", subtitleAlign === 'left' && "bg-secondary")}
                                            >
                                                <span>Left (YouTube style)</span>
                                                {subtitleAlign === 'left' && <div className="h-1.5 w-1.5 rounded-full bg-red-500 mr-2" />}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => setSubtitleAlign('center')}
                                                className={cn("text-[12px] flex items-center justify-between cursor-pointer py-2 pl-8 hover:bg-secondary", subtitleAlign === 'center' && "bg-secondary")}
                                            >
                                                <span>Center</span>
                                                {subtitleAlign === 'center' && <div className="h-1.5 w-1.5 rounded-full bg-red-500 mr-2" />}
                                            </DropdownMenuItem>
    
                                            <DropdownMenuSeparator className="bg-white/10" />
                                            <div className="px-3 py-2 text-[11px] font-bold text-white/60">Speed</div>
                                            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                                                <DropdownMenuItem
                                                    key={rate}
                                                    onClick={() => onPlaybackRateChange(rate)}
                                                    className={cn(
                                                        "text-[12px] flex items-center justify-between cursor-pointer py-2 pl-8 hover:bg-secondary",
                                                        playbackRate === rate && "bg-secondary"
                                                    )}
                                                >
                                                    <span>{rate}x</span>
                                                    {playbackRate === rate && <div className="h-1.5 w-1.5 rounded-full bg-red-500 mr-2" />}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
});

LumenVideoPlayer.displayName = 'LumenVideoPlayer';
