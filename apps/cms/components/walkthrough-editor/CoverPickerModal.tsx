'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileUpload, FileWithProgress } from '@/components/ui/file-upload';
import { LumenVideoPlayer } from '@/components/shared/video/LumenVideoPlayer';
import { LumenTimeline } from '@/components/shared/video/LumenTimeline';
import { useLumenReview, S3UrlSigningService } from '@luma/infra';
import { Image as ImageIcon, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import axios from 'axios';
import { ENV } from '@/lib/env';

interface CoverPickerModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    walkthroughId: string;
    stepId?: string;
    observerSessionId?: string | null;
    onSelect: (s3PathWithoutBucket: string) => void;
}

interface MediaAsset {
    id: string;
    url: string;
    name: string;
    createdAt: string;
}

const GALLERY_KEY = (pid: string) => `luma-media-${pid}`;

function useProjectMedia(projectId: string) {
    const [media, setMedia] = useState<MediaAsset[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(GALLERY_KEY(projectId));
            if (stored) {
                setMedia(JSON.parse(stored) as MediaAsset[]);
            }
        } catch (err) {
            console.error('Failed to load media gallery:', err);
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    const addMedia = (url: string, name: string) => {
        const asset: MediaAsset = {
            id: `${Date.now()}`,
            url,
            name,
            createdAt: new Date().toISOString(),
        };
        setMedia((prev) => [asset, ...prev]);
        try {
            localStorage.setItem(GALLERY_KEY(projectId), JSON.stringify([asset, ...media]));
        } catch (err) {
            console.error('Failed to save media:', err);
        }
    };

    const removeMedia = (id: string) => {
        const updated = media.filter((m) => m.id !== id);
        setMedia(updated);
        try {
            localStorage.setItem(GALLERY_KEY(projectId), JSON.stringify(updated));
        } catch (err) {
            console.error('Failed to remove media:', err);
        }
    };

    return { media, isLoading, addMedia, removeMedia };
}

export function CoverPickerModal({
    open,
    onOpenChange,
    projectId,
    walkthroughId,
    stepId,
    observerSessionId,
    onSelect,
}: CoverPickerModalProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const [activeTab, setActiveTab] = useState<'gallery' | 'upload' | 'capture'>('gallery');
    const [isCapturing, setIsCapturing] = useState(false);
    const [isVideoLoading, setIsVideoLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [videoDuration, setVideoDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [volume, setVolume] = useState(1);
    const [lastVolume, setLastVolume] = useState(1);

    const { media, isLoading: mediaLoading, addMedia, removeMedia } = useProjectMedia(projectId);
    const { data: lumenReview } = useLumenReview(observerSessionId ?? undefined);

    const videoUrl = lumenReview?.videoUrl ?? null;

    useEffect(() => {
        if (open && activeTab === 'capture' && videoRef.current) {
            setIsPlaying(false);
            setCurrentTime(0);
        }
    }, [open, activeTab]);

    const togglePlayback = () => {
        if (!videoRef.current) return;
        if (videoRef.current.paused) {
            videoRef.current.play().catch(() => undefined);
        } else {
            videoRef.current.pause();
        }
    };

    const handleSeek = (sec: number) => {
        if (videoRef.current) videoRef.current.currentTime = sec;
        setCurrentTime(sec);
    };

    const handleCaptureFrame = async () => {
        if (!videoRef.current || !canvasRef.current) return;

        try {
            setIsCapturing(true);
            const video = videoRef.current;
            const canvas = canvasRef.current;

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Failed to get canvas context');

            ctx.drawImage(video, 0, 0);

            // Convert to JPEG blob
            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob(
                    (b) => {
                        if (b) resolve(b);
                        else reject(new Error('Failed to create blob'));
                    },
                    'image/jpeg',
                    0.9
                );
            });

            // Upload to S3
            const filename = `frame-${Date.now()}.jpg`;
            const uploadPath = stepId
                ? `projects/${projectId}/walkthroughs/${walkthroughId}/steps/${stepId}/capture`
                : `projects/${projectId}/walkthroughs/${walkthroughId}/cover/capture`;

            const signedUrlResponse = await S3UrlSigningService.create({
                type: 'project-media',
                filename,
                path: uploadPath,
            });

            await axios.put(signedUrlResponse.signedUrl, blob, {
                headers: { 'Content-Type': 'image/jpeg' },
            });

            const s3Path = signedUrlResponse.s3PathWithoutBucket;
            addMedia(s3Path, filename);
            onSelect(s3Path);
            onOpenChange(false);
            toast.success('Frame captured and added to gallery');
        } catch (error) {
            console.error('Failed to capture frame:', error);
            toast.error('Failed to capture frame');
        } finally {
            setIsCapturing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-4xl h-[80vh] p-0 gap-0 overflow-hidden bg-background dark:bg-[#111114]"
                style={{ display: 'flex', flexDirection: 'column' }}
            >
                {/* Header */}
                <DialogHeader className="h-12 pl-4 pr-12 border-b border-border flex items-center justify-between bg-background-secondary/40 dark:bg-[#09090b] shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-sm font-bold">
                        <ImageIcon className="h-4 w-4 text-accent-blue" />
                        Choose Cover
                    </DialogTitle>
                </DialogHeader>

                {/* Tab buttons */}
                <div className="h-10 px-3 border-b border-border flex items-center gap-1 bg-background-secondary/20 shrink-0">
                    <button
                        onClick={() => setActiveTab('gallery')}
                        className={cn(
                            'h-7 px-3 rounded-md text-[11px] font-bold gap-1.5 flex items-center transition-colors',
                            activeTab === 'gallery'
                                ? 'bg-accent-blue/10 text-accent-blue'
                                : 'text-foreground-muted hover:text-foreground hover:bg-background-secondary/50'
                        )}
                    >
                        Gallery
                    </button>
                    <button
                        onClick={() => setActiveTab('upload')}
                        className={cn(
                            'h-7 px-3 rounded-md text-[11px] font-bold gap-1.5 flex items-center transition-colors',
                            activeTab === 'upload'
                                ? 'bg-accent-blue/10 text-accent-blue'
                                : 'text-foreground-muted hover:text-foreground hover:bg-background-secondary/50'
                        )}
                    >
                        Upload
                    </button>
                    {observerSessionId && (
                        <button
                            onClick={() => setActiveTab('capture')}
                            className={cn(
                                'h-7 px-3 rounded-md text-[11px] font-bold gap-1.5 flex items-center transition-colors',
                                activeTab === 'capture'
                                    ? 'bg-accent-blue/10 text-accent-blue'
                                    : 'text-foreground-muted hover:text-foreground hover:bg-background-secondary/50'
                            )}
                        >
                            Capture
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {activeTab === 'gallery' && (
                        <div className="space-y-4">
                            {mediaLoading ? (
                                <div className="flex justify-center items-center h-40">
                                    <Loader2 className="h-6 w-6 animate-spin text-accent-blue/40" />
                                </div>
                            ) : media.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 text-center space-y-2">
                                    <div className="h-12 w-12 rounded-full bg-background-secondary flex items-center justify-center opacity-40">
                                        <ImageIcon className="h-6 w-6 text-foreground-muted" />
                                    </div>
                                    <p className="text-sm text-foreground-muted font-medium">
                                        No images in gallery yet
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-3">
                                    {media.map((asset) => (
                                        <div
                                            key={asset.id}
                                            className="group relative aspect-video rounded-lg overflow-hidden bg-background-secondary/50 border border-border/30 cursor-pointer hover:border-border/60 transition-all"
                                            onClick={() => {
                                                onSelect(asset.url);
                                                onOpenChange(false);
                                            }}
                                        >
                                            <img
                                                src={
                                                    asset.url.startsWith('http')
                                                        ? asset.url
                                                        : `${ENV.S3_URL_BASE}/${asset.url}`
                                                }
                                                alt={asset.name}
                                                className="w-full h-full object-cover"
                                            />
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeMedia(asset.id);
                                                }}
                                                className="absolute top-1 right-1 p-1 bg-black/60 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                                            >
                                                <Trash2 className="h-3 w-3 text-white" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'upload' && (
                        <div className="space-y-3">
                            <p className="text-sm text-foreground-muted">
                                Upload an image to your project gallery
                            </p>
                            <FileUpload
                                allowedTypes={['image/*']}
                                s3Type="project-media"
                                uploadPath={`projects/${projectId}/media`}
                                onUploadSuccess={(files: FileWithProgress[]) => {
                                    if (files[0]?.fileUrl) {
                                        addMedia(
                                            files[0].fileUrl,
                                            files[0].file.name
                                        );
                                        onSelect(files[0].fileUrl);
                                        onOpenChange(false);
                                    }
                                }}
                                showDropzone={true}
                                placeholder="Upload cover image"
                            />
                        </div>
                    )}

                    {activeTab === 'capture' && observerSessionId && (
                        <div className="space-y-4">
                            {videoUrl ? (
                                <>
                                    <div className="aspect-video rounded-lg overflow-hidden bg-black border border-border/30">
                                        <LumenVideoPlayer
                                            ref={videoRef}
                                            videoUrl={videoUrl}
                                            isVideoLoading={isVideoLoading}
                                            isPlaying={isPlaying}
                                            currentTime={currentTime}
                                            durationSec={videoDuration}
                                            playbackRate={playbackRate}
                                            showSubtitles={false}
                                            subtitleSegments={[]}
                                            activeSegment={null}
                                            onTogglePlayback={togglePlayback}
                                            onToggleSubtitles={() => undefined}
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
                                            onEnded={(t) => { setIsPlaying(false); if (t > 0) setVideoDuration(t); }}
                                            renderTimeline={() => (
                                                <LumenTimeline
                                                    durationSec={videoDuration || 1}
                                                    currentTime={currentTime}
                                                    progressPercent={videoDuration ? (currentTime / videoDuration) * 100 : 0}
                                                    reviewSteps={[]}
                                                    activeStepId={null}
                                                    onSeek={handleSeek}
                                                    onScrub={handleSeek}
                                                />
                                            )}
                                            hideControls={false}
                                            formatTime={(seconds: number) => {
                                                if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
                                                const mins = Math.floor(seconds / 60);
                                                const secs = Math.floor(seconds % 60);
                                                return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                                            }}
                                        />
                                    </div>
                                    <div className="flex justify-end">
                                        <Button
                                            onClick={handleCaptureFrame}
                                            disabled={isCapturing}
                                            className="gap-2 text-sm font-bold bg-accent-blue hover:bg-accent-blue/90 text-white"
                                        >
                                            {isCapturing ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Capturing…
                                                </>
                                            ) : (
                                                <>
                                                    <ImageIcon className="h-4 w-4" />
                                                    Capture frame
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-40 text-center space-y-2">
                                    <p className="text-sm text-foreground-muted font-medium">
                                        No video source available
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Hidden canvas for frame capture */}
                <canvas ref={canvasRef} className="hidden" />
            </DialogContent>
        </Dialog>
    );
}
