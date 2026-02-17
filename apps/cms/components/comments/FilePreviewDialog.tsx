'use client';

import { useState, useCallback } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
    Download,
    ExternalLink,
    Loader2,
    ChevronLeft,
    ChevronRight,
    ZoomIn,
    ZoomOut,
    RotateCw,
    X,
} from 'lucide-react';
import { ENV } from '@/lib/env';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i;
const VIDEO_EXTS = /\.(mp4|webm|ogg|mov|avi)$/i;
const AUDIO_EXTS = /\.(mp3|wav|ogg|aac|flac)$/i;

export type PreviewableFile = {
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    s3Key: string;
};

export function isImage(file: PreviewableFile): boolean {
    return IMAGE_EXTS.test(file.fileName) || file.fileType.startsWith('image/');
}

export function isVideo(file: PreviewableFile): boolean {
    return VIDEO_EXTS.test(file.fileName) || file.fileType.startsWith('video/');
}

export function isAudio(file: PreviewableFile): boolean {
    return AUDIO_EXTS.test(file.fileName) || file.fileType.startsWith('audio/');
}

export function isPreviewable(file: PreviewableFile): boolean {
    return isImage(file) || isVideo(file);
}

function getFullUrl(s3Key: string): string {
    return `${ENV.S3_URL_BASE}${s3Key}`;
}

function getGoogleDocsUrl(s3Key: string): string {
    const fullUrl = getFullUrl(s3Key);
    return `https://docs.google.com/viewer?url=${encodeURIComponent(fullUrl)}&embedded=true`;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

interface FilePreviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    file: PreviewableFile | null;
    /** All files in the same comment – enables prev/next navigation */
    files?: PreviewableFile[];
    onNavigate?: (file: PreviewableFile) => void;
}

export function FilePreviewDialog({
    open,
    onOpenChange,
    file,
    files,
    onNavigate,
}: FilePreviewDialogProps) {
    const t = useTranslations('Comments');
    const [isDownloading, setIsDownloading] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);

    // Reset state when file changes
    const resetState = useCallback(() => {
        setImageLoading(true);
        setZoom(1);
        setRotation(0);
    }, []);

    const currentIndex = files && file ? files.findIndex((f) => f.id === file.id) : -1;
    const hasPrev = currentIndex > 0;
    const hasNext = files ? currentIndex < files.length - 1 : false;

    const goTo = useCallback(
        (direction: 'prev' | 'next') => {
            if (!files || !onNavigate) return;
            const idx = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
            if (idx >= 0 && idx < files.length) {
                resetState();
                onNavigate(files[idx]!);
            }
        },
        [files, onNavigate, currentIndex, resetState],
    );

    const handleDownload = useCallback(async () => {
        if (!file) return;
        setIsDownloading(true);
        try {
            const response = await fetch(getFullUrl(file.s3Key));
            if (!response.ok) throw new Error('Download failed');
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = file.fileName;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(blobUrl);
            }, 100);
        } catch {
            toast.error(t('downloadError'));
        } finally {
            setIsDownloading(false);
        }
    }, [file, t]);

    const handleOpenExternal = useCallback(() => {
        if (!file) return;
        window.open(getFullUrl(file.s3Key), '_blank');
    }, [file]);

    if (!file) return null;

    const fileIsImage = isImage(file);
    const fileIsVideo = isVideo(file);
    const fileIsAudio = isAudio(file);
    // Documents (PDF, Office) get Google Docs viewer
    const fileIsDocument = !fileIsImage && !fileIsVideo && !fileIsAudio;

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                if (!v) resetState();
                onOpenChange(v);
            }}
        >
            <DialogContent
                className={cn(
                    'flex flex-col gap-0 p-0 overflow-hidden border-none [&>button:last-child]:hidden',
                    fileIsImage || fileIsVideo
                        ? 'max-w-[90vw] w-fit max-h-[90vh]'
                        : 'max-w-[90vw] h-[90vh]',
                )}
            >
                {/* Header */}
                <DialogHeader className="flex flex-row items-center justify-between gap-2 px-4 py-3 border-b bg-background shrink-0">
                    <DialogTitle className="text-sm font-medium truncate max-w-[50%]">
                        {file.fileName}
                    </DialogTitle>
                    <div className="flex items-center gap-1">
                        {/* Image zoom/rotate controls */}
                        {fileIsImage && (
                            <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
                                        >
                                            <ZoomOut className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs">{t('zoomOut')}</TooltipContent>
                                </Tooltip>
                                <span className="text-xs text-foreground-muted min-w-[3ch] text-center">
                                    {Math.round(zoom * 100)}%
                                </span>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                                        >
                                            <ZoomIn className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs">{t('zoomIn')}</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => setRotation((r) => (r + 90) % 360)}
                                        >
                                            <RotateCw className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs">{t('rotate')}</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}

                        {/* Navigation when multiple files */}
                        {files && files.length > 1 && (
                            <div className="flex items-center gap-0.5 ml-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    disabled={!hasPrev}
                                    onClick={() => goTo('prev')}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-xs text-foreground-muted">
                                    {currentIndex + 1}/{files.length}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    disabled={!hasNext}
                                    onClick={() => goTo('next')}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}

                        {/* Open in new tab */}
                        <TooltipProvider delayDuration={200}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={handleOpenExternal}
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-xs">{t('openInNewTab')}</TooltipContent>
                            </Tooltip>

                            {/* Download */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={handleDownload}
                                        disabled={isDownloading}
                                    >
                                        {isDownloading ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Download className="h-4 w-4" />
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-xs">{t('downloadFile')}</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        {/* Close */}
                        <DialogPrimitive.Close asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 ml-1"
                            >
                                <X className="h-4 w-4" />
                                <span className="sr-only">Close</span>
                            </Button>
                        </DialogPrimitive.Close>
                    </div>
                </DialogHeader>

                {/* Content */}
                <div
                    className={cn(
                        'flex-1 w-full overflow-auto min-h-0',
                        fileIsImage && 'flex items-center justify-center bg-black/5 dark:bg-white/5 min-h-[300px]',
                        fileIsVideo && 'flex items-center justify-center bg-black min-h-[300px]',
                        fileIsAudio && 'flex items-center justify-center p-8 min-h-[120px]',
                    )}
                >
                    {fileIsImage && (
                        <div className="relative p-4">
                            {imageLoading && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-foreground-muted" />
                                </div>
                            )}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={getFullUrl(file.s3Key)}
                                alt={file.fileName}
                                className="max-w-full max-h-[75vh] object-contain rounded-md transition-transform duration-200"
                                style={{
                                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                                    opacity: imageLoading ? 0 : 1,
                                }}
                                onLoad={() => setImageLoading(false)}
                                onError={() => setImageLoading(false)}
                                draggable={false}
                            />
                        </div>
                    )}

                    {fileIsVideo && (
                        <video
                            src={getFullUrl(file.s3Key)}
                            controls
                            className="max-w-full max-h-[75vh] rounded-md"
                            preload="metadata"
                        >
                            <track kind="captions" />
                        </video>
                    )}

                    {fileIsAudio && (
                        <audio src={getFullUrl(file.s3Key)} controls className="w-full max-w-md">
                            <track kind="captions" />
                        </audio>
                    )}

                    {fileIsDocument && (
                        <iframe
                            src={getGoogleDocsUrl(file.s3Key)}
                            className="w-full h-full min-h-0 border-0"
                            title={file.fileName}
                            allowFullScreen
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}


