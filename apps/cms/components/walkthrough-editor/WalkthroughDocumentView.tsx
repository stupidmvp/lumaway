'use client';

import React from 'react';
import { Step, useLumenReview } from '@luma/infra';
import { useTranslations } from 'next-intl';
import { Hash, Plus, GripVertical, MoreVertical, RefreshCw, Trash2, Smile, Image as ImageIcon, MessageSquare, ChevronDown, ChevronRight, X, Video, Play, Film } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLumens } from '@luma/infra';
import { StepCoverCaptureModal } from './StepCoverCaptureModal';
import { CoverPickerModal } from './CoverPickerModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CommentsPanel } from '@/components/comments/CommentsPanel';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { FileUpload } from '@/components/ui/file-upload';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useTheme } from 'next-themes';
import { ENV } from '@/lib/env';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
    DndContext,
    closestCenter,
    DragEndEvent,
    SensorDescriptor,
    SensorOptions,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
interface WalkthroughDocumentViewProps {
    projectId: string;
    walkthroughId: string;
    title: string;
    icon: string | null;
    coverUrl: string | null;
    observerSessionId: string | null;
    description: string | null;
    steps: Step[];
    canEdit: boolean;
    onTitleChange: (title: string) => void;
    onIconChange: (icon: string | null) => void;
    onCoverChange: (coverUrl: string | null) => void;
    onObserverSessionChange: (id: string | null) => void;
    onDescriptionChange: (description: string) => void;
    onUpdateStep: (index: number, field: keyof Step, value: any) => void;
    onAddStep: (index?: number) => void;
    onRemoveStep: (index: number) => void;
    onDragEnd: (event: DragEndEvent) => void;
    sensors: SensorDescriptor<SensorOptions>[];
    selectedStepIndex: number;
    onSelectStep: (index: number) => void;
    onGenerateGifs: () => Promise<void>;
    isGeneratingGifs: boolean;
    onSyncTimings: () => Promise<void>;
    toggleMediaLibrary: () => void;
}
interface SortableStepBlockProps {
    projectId: string;
    walkthroughId: string;
    step: Step;
    index: number;
    canEdit: boolean;
    isFocused: boolean;
    videoUrl?: string | null;
    onUpdateStep: (index: number, field: keyof Step, value: any) => void;
    onAddStep: (index?: number) => void;
    onRemoveStep: (index: number) => void;
    onSelectStep: (index: number) => void;
    onCaptureCover: (stepId: string) => void;
    t: any;
}

function SortableStepBlock({
    projectId,
    walkthroughId,
    step,
    index,
    canEdit,
    isFocused,
    videoUrl,
    onUpdateStep,
    onAddStep,
    onRemoveStep,
    onSelectStep,
    onCaptureCover,
    t
}: SortableStepBlockProps) {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const hasVisual = Boolean(step.coverUrl || step.gifUrl);
    const canAddCover = canEdit && !hasVisual;
    const hasVideoSource = Boolean(videoUrl) && step.startMs != null && step.endMs != null;

    React.useEffect(() => {
        if (isFocused && inputRef.current && !step.title) {
            inputRef.current.focus();
        }
    }, [isFocused, step.title]);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
        setActivatorNodeRef
    } = useSortable({ id: step.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={() => onSelectStep(index)}
            className={cn(
                "group/step relative flex items-start gap-2 py-0.5 transition-opacity duration-200 cursor-pointer outline-none focus:outline-none focus-visible:outline-none",
                isDragging ? "opacity-50 z-50" : "opacity-100"
            )}
        >
            {/* Step Controls */}
            <div
                className={cn(
                    "sticky top-3 z-20 flex w-10 shrink-0 items-center justify-end gap-0.5 pt-[9px] transition-all duration-150",
                    isFocused ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-1 group-hover/step:opacity-100 group-hover/step:translate-x-0"
                )}
            >
                {canEdit && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onAddStep(index + 1); }}
                        className="flex h-6 w-6 items-center justify-center rounded text-foreground-muted/30 transition-all hover:bg-background-secondary hover:text-foreground-muted"
                        title="Add step below"
                    >
                        <Plus className="h-3.5 w-3.5" />
                    </button>
                )}
                <div
                    ref={setActivatorNodeRef}
                    {...attributes}
                    {...listeners}
                    className={cn(
                        "flex h-6 w-6 cursor-grab items-center justify-center rounded text-foreground-muted/30 transition-all active:cursor-grabbing hover:bg-background-secondary hover:text-foreground-muted",
                        !canEdit && "pointer-events-none"
                    )}
                    title="Drag to reorder"
                >
                    <GripVertical className="h-3.5 w-3.5" />
                </div>
            </div>

            <div
                className={cn(
                    "relative flex min-w-0 flex-1 flex-col rounded-md px-3 py-2 transition-all duration-150",
                    isFocused
                        ? "bg-accent-blue/[0.04] dark:bg-accent-blue/[0.06]"
                        : "hover:bg-background-secondary/20",
                    isDragging && "bg-background shadow-sm"
                )}
            >
                <div className="flex min-w-0 flex-col gap-3">
                    {/* Add Cover Trigger */}
                    {canAddCover && (
                        <div className={cn(
                            "flex h-6 items-center transition-opacity duration-200",
                            isFocused ? "opacity-100" : "opacity-0 group-hover/step:opacity-100"
                        )}>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex h-6 items-center gap-1.5 rounded px-2 text-[10px] font-medium text-foreground-muted/35 transition-all hover:bg-background-secondary hover:text-foreground-muted/70"
                                    >
                                        <ImageIcon className="h-3 w-3 opacity-60" />
                                        Add cover
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-72 shadow-2xl border-border/40 bg-background/95 backdrop-blur-md">
                                    {/* Option 1: Upload */}
                                    <div className="p-4 pb-3">
                                        <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider mb-3">Upload image</p>
                                        <FileUpload
                                            s3Type="walkthrough-step-cover"
                                            uploadPath={`projects/${projectId}/walkthroughs/${walkthroughId}/steps/${step.id}`}
                                            onUploadSuccess={(files) => {
                                                if (files[0]?.fileUrl) onUpdateStep(index, 'coverUrl', files[0].fileUrl);
                                            }}
                                            showDropzone={true}
                                            placeholder="Upload step cover"
                                        />
                                    </div>
                                    {/* Option 2: Capture from video */}
                                    {hasVideoSource && (
                                        <>
                                            <div className="border-t border-border/40 mx-4" />
                                            <div className="p-2">
                                                <DropdownMenuItem
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onCaptureCover(step.id);
                                                    }}
                                                    className="gap-2 text-xs font-medium cursor-pointer rounded-md"
                                                >
                                                    <Film className="h-3.5 w-3.5 text-accent-blue opacity-80" />
                                                    Capture from video
                                                </DropdownMenuItem>
                                            </div>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}

                    {/* Step Visual Support (Cover or GIF) */}
                    {hasVisual && (
                        <div className="relative w-full aspect-[16/7] max-h-[180px] rounded-xl overflow-hidden bg-background-secondary/50 mb-4 group/step-visual border border-border/30 shadow-md ring-1 ring-black/5">
                            <img 
                                src={(() => {
                                    const url = step.coverUrl || step.gifUrl;
                                    if (!url) return '';
                                    if (url.startsWith('http')) return url;
                                    return `${ENV.S3_URL_BASE}/${url}`;
                                })()}
                                alt="Step visual"
                                className="w-full h-full object-cover transition-transform duration-500 group-hover/step-visual:scale-[1.02]"
                            />
                            {canEdit && (
                                <>
                                    <div className="absolute bottom-3 right-3 opacity-0 group-hover/step-visual:opacity-100 transition-all transform translate-y-1 group-hover/step-visual:translate-y-0 z-10">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="secondary" size="sm" className="bg-black/60 backdrop-blur-xl border-none text-[11px] font-bold h-7 px-3 hover:bg-black/80 transition-all shadow-xl text-white rounded-full">
                                                    Change cover
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-72 shadow-2xl border-border/40 bg-background/95 backdrop-blur-md">
                                                {/* Option 1: Upload */}
                                                <div className="p-4 pb-3">
                                                    <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider mb-3">Upload image</p>
                                                    <FileUpload
                                                        s3Type="walkthrough-step-cover"
                                                        uploadPath={`projects/${projectId}/walkthroughs/${walkthroughId}/steps/${step.id}`}
                                                        onUploadSuccess={(files) => {
                                                            if (files[0]?.fileUrl) onUpdateStep(index, 'coverUrl', files[0].fileUrl);
                                                        }}
                                                        showDropzone={true}
                                                        placeholder="Upload new cover"
                                                    />
                                                </div>
                                                {/* Option 2: Capture from video */}
                                                {hasVideoSource && (
                                                    <>
                                                        <div className="border-t border-border/40 mx-4" />
                                                        <div className="p-2">
                                                            <DropdownMenuItem
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onCaptureCover(step.id);
                                                                }}
                                                                className="gap-2 text-xs font-medium cursor-pointer rounded-md"
                                                            >
                                                                <Film className="h-3.5 w-3.5 text-accent-blue opacity-80" />
                                                                Capture from video
                                                            </DropdownMenuItem>
                                                        </div>
                                                    </>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onUpdateStep(index, 'coverUrl', null);
                                            onUpdateStep(index, 'gifUrl', null);
                                        }}
                                        className="absolute top-3 right-3 p-2 bg-black/60 backdrop-blur-xl rounded-full text-white opacity-0 group-hover/step-visual:opacity-100 transition-all hover:bg-destructive hover:scale-110 z-20 shadow-xl"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                <div className="flex flex-col gap-1.5">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1">
                        <input
                            ref={inputRef}
                            value={step.title || ''}
                            onChange={(e) => canEdit && onUpdateStep(index, 'title', e.target.value)}
                            readOnly={!canEdit}
                            placeholder={t('untitledStep')}
                            className={cn(
                                "min-w-0 flex-1 bg-transparent border-none text-[15px] font-bold text-foreground placeholder:text-foreground-muted/20 focus:ring-0 p-0",
                                !canEdit && "cursor-default"
                            )}
                        />
                        {canEdit && (
                            <div className={cn(
                                "row-span-2",
                                "shrink-0 transition-opacity duration-200",
                                isFocused ? "opacity-100" : "opacity-0 group-hover/step:opacity-100"
                            )}>
                                <AlertDialog>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                onClick={(e) => e.stopPropagation()}
                                                className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted/35 transition-colors hover:bg-background-secondary hover:text-foreground-muted"
                                            >
                                                <MoreVertical className="h-4 w-4" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48 rounded-lg shadow-xl border-border/40">
                                            <AlertDialogTrigger asChild>
                                                <DropdownMenuItem className="text-destructive focus:text-destructive gap-2 cursor-pointer m-0.5 rounded">
                                                    <Trash2 className="h-4 w-4" />
                                                    <span>{t('deleteStep')}</span>
                                                </DropdownMenuItem>
                                            </AlertDialogTrigger>
                                        </DropdownMenuContent>
                                    </DropdownMenu>

                                    <AlertDialogContent className="rounded-xl border-border/40">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>{t('deleteStepConfirmTitle') || 'Delete Step?'}</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                {t('deleteStepConfirmDescription') || 'This action cannot be undone. This step will be permanently removed from the walkthrough.'}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel className="rounded-lg">{t('cancel') || 'Cancel'}</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => onRemoveStep(index)}
                                                className="bg-destructive text-white hover:bg-destructive/90 rounded-lg"
                                            >
                                                {t('delete') || 'Delete'}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        )}
                        <div className="col-start-1 flex min-h-4 flex-wrap items-center gap-1.5">
                            {step.startMs != null && step.endMs != null && !step.gifUrl && !step.coverUrl && (
                                <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider text-accent-blue/40 border-accent-blue/10 bg-accent-blue/5 h-4 px-1.5 shrink-0">
                                    Ready for GIF
                                </Badge>
                            )}
                            {(step.startMs == null || step.endMs == null) && (
                                <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider text-foreground-muted/20 border-border/40 h-4 px-1.5 shrink-0" title="No timing linked from video">
                                    No timing
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Step Description */}
                    <div>
                        <textarea
                            value={step.description || ''}
                            onChange={(e) => {
                                if (canEdit) {
                                    onUpdateStep(index, 'description', e.target.value);
                                    e.target.style.height = 'auto';
                                    e.target.style.height = e.target.scrollHeight + 'px';
                                }
                            }}
                            onFocus={(e) => {
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';
                            }}
                            readOnly={!canEdit}
                            placeholder={t('noDescription')}
                            rows={1}
                            className={cn(
                                "w-full bg-transparent border-transparent outline-none focus:bg-transparent focus:border-transparent focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none shadow-none focus:shadow-none p-0 text-[15.5px] text-foreground/70 dark:text-foreground-subtle/90 leading-relaxed resize-none overflow-hidden placeholder:text-foreground-muted/20",
                                canEdit ? "cursor-text" : "cursor-default"
                            )}
                        />

                    {/* Technical Target */}
                    {step.target && (
                        <div className={cn(
                            "mt-1.5 inline-flex items-center gap-1 text-foreground-muted/40 transition-opacity duration-150",
                            isFocused ? "opacity-100" : "opacity-0 group-hover/step:opacity-100"
                        )}>
                            <Hash className="h-2.5 w-2.5" />
                            <code className="text-[10.5px] font-mono truncate max-w-[400px]">{step.target}</code>
                        </div>
                    )}
                </div>
            </div>
        </div>
        </div>
        </div>
    );
}

export function WalkthroughDocumentView({
    projectId,
    walkthroughId,
    title,
    icon,
    coverUrl,
    observerSessionId,
    description,
    steps,
    canEdit,
    onTitleChange,
    onIconChange,
    onCoverChange,
    onObserverSessionChange,
    onDescriptionChange,
    onUpdateStep,
    onAddStep,
    onRemoveStep,
    onDragEnd,
    sensors,
    selectedStepIndex,
    onSelectStep,
    onGenerateGifs,
    isGeneratingGifs,
    onSyncTimings,
    toggleMediaLibrary
}: WalkthroughDocumentViewProps) {
    const t = useTranslations('Editor');
    const { theme } = useTheme();
    const titleRef = React.useRef<HTMLTextAreaElement>(null);
    const descRef = React.useRef<HTMLTextAreaElement>(null);
    const [isCommentsExpanded, setIsCommentsExpanded] = React.useState(true);

    // Capture modal state
    const [captureStepId, setCaptureStepId] = React.useState<string | null>(null);
    const captureStep = React.useMemo(
        () => steps.find((s) => s.id === captureStepId) ?? null,
        [captureStepId, steps]
    );

    // Cover picker modal state
    const [coverPickerOpen, setCoverPickerOpen] = React.useState(false);

    // Get video URL from linked observer session
    const { data: lumenReview } = useLumenReview(observerSessionId ?? undefined);
    const videoUrl = lumenReview?.videoUrl ?? null;
    const videoDurationMs = lumenReview?.session?.videoDurationMs ?? null;

    const { data: lumensData } = useLumens(projectId);
    const lumens = Array.isArray(lumensData) ? lumensData : lumensData?.data ?? [];

    // Auto-resize on mount
    React.useEffect(() => {
        if (titleRef.current) {
            titleRef.current.style.height = 'auto';
            titleRef.current.style.height = titleRef.current.scrollHeight + 'px';
        }
        if (descRef.current) {
            descRef.current.style.height = 'auto';
            descRef.current.style.height = descRef.current.scrollHeight + 'px';
        }
    }, [title, description]);

    return (
        <div className="flex-1 flex flex-col pb-32">
            {/* Cover Area */}
            <div className="relative group/cover w-full">
                {coverUrl ? (
                    <div className="relative h-[30vh] min-h-[200px] max-h-[300px] w-full overflow-hidden">
                        <img 
                            src={`${ENV.S3_URL_BASE}/${coverUrl}`} 
                            alt="Cover" 
                            className="w-full h-full object-cover"
                        />
                        {canEdit && (
                            <>
                                <div className="absolute bottom-4 right-4 opacity-0 group-hover/cover:opacity-100 transition-opacity z-10">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="bg-background/80 backdrop-blur-md border-none text-xs h-7 hover:bg-background/90 transition-all shadow-sm"
                                        onClick={() => setCoverPickerOpen(true)}
                                    >
                                        Change cover
                                    </Button>
                                </div>

                                <button
                                    onClick={() => onCoverChange(null)}
                                    className="absolute top-4 right-4 p-1.5 bg-background/60 backdrop-blur-md border border-white/20 rounded-full shadow-sm opacity-0 group-hover/cover:opacity-100 transition-all hover:bg-destructive/20 hover:text-destructive z-20 text-white"
                                    title="Remove cover"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="h-12 w-full" />
                )}
            </div>

            {/* Content Container */}
            <div className="max-w-[800px] mx-auto w-full px-12 relative">
                {/* Icon / Emoji Area (overlapping cover) */}
                <div className={cn(
                    "relative z-20 group/icon inline-block",
                    coverUrl ? "-mt-[60px]" : "mt-2"
                )}>
                    {icon ? (
                        <div className="relative inline-block">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <button className="text-[78px] leading-none hover:bg-foreground/5 rounded-2xl p-2 transition-all -ml-2 select-none outline-none">
                                        {icon}
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0 border-none bg-transparent shadow-none" side="bottom" align="start">
                                    <Picker 
                                        data={data} 
                                        onEmojiSelect={(emoji: any) => onIconChange(emoji.native)}
                                        theme={theme === 'dark' ? 'dark' : 'light'}
                                    />
                                </PopoverContent>
                            </Popover>
                            {canEdit && (
                                <button 
                                    onClick={() => onIconChange(null)}
                                    className="absolute -top-1 -right-1 p-1.5 bg-background border border-border rounded-full shadow-sm opacity-0 group-hover/icon:opacity-100 transition-opacity hover:bg-muted"
                                >
                                    <X className="h-3 w-3 text-foreground-muted" />
                                </button>
                            )}
                        </div>
                    ) : (
                        canEdit && (
                            <div className="flex items-center gap-4 h-8 mb-4 opacity-0 hover:opacity-100 transition-opacity">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button className="text-[14px] font-medium text-foreground-muted/60 hover:text-foreground flex items-center gap-1.5 transition-colors">
                                            <Smile className="h-4 w-4" />
                                            Add icon
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="p-0 border-none bg-transparent shadow-none" side="bottom" align="start">
                                        <Picker 
                                            data={data} 
                                            onEmojiSelect={(emoji: any) => onIconChange(emoji.native)}
                                            theme={theme === 'dark' ? 'dark' : 'light'}
                                        />
                                    </PopoverContent>
                                </Popover>
                                
                                {!coverUrl && (
                                    <button
                                        onClick={() => setCoverPickerOpen(true)}
                                        className="text-[14px] font-medium text-foreground-muted/60 hover:text-foreground flex items-center gap-1.5 transition-colors"
                                    >
                                        <ImageIcon className="h-4 w-4" />
                                        Add cover
                                    </button>
                                )}

                                {!observerSessionId && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button className="text-[14px] font-medium text-foreground-muted/60 hover:text-foreground flex items-center gap-1.5 transition-colors">
                                                <Video className="h-4 w-4" />
                                                Add video source
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" className="w-72 max-h-96 overflow-y-auto p-1">
                                            <div className="px-2 py-1.5 text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                                                Select a Lumen
                                            </div>
                                            {lumens.map((lumen: any) => (
                                                <DropdownMenuItem 
                                                    key={lumen.id} 
                                                    className="flex flex-col items-start gap-0.5 py-2 cursor-pointer"
                                                    onClick={() => onObserverSessionChange(lumen.id)}
                                                >
                                                    <div className="font-medium text-sm flex items-center gap-2">
                                                        <Play className="h-3 w-3 text-accent-blue" />
                                                        {lumen.intent || 'Untitled Lumen'}
                                                    </div>
                                                    <div className="text-[11px] text-foreground-muted truncate w-full">
                                                        {new Date(lumen.createdAt).toLocaleDateString()} • {lumen.captureSource}
                                                    </div>
                                                </DropdownMenuItem>
                                            ))}
                                            {lumens.length === 0 && (
                                                <div className="p-4 text-center text-xs text-foreground-muted italic">
                                                    No Lumens found for this project
                                                </div>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>
                        )
                    )}
                </div>

                    {observerSessionId ? (
                        <div className="mb-6 flex items-center gap-1.5">
                            <div className="flex items-center gap-1.5 h-6 px-2 rounded-md bg-accent-blue/8 border border-accent-blue/15 text-accent-blue/70 text-[11px] font-medium">
                                <Video className="h-3 w-3 opacity-70 shrink-0" />
                                <span className="truncate max-w-[200px]">
                                    {lumens.find(l => l.id === observerSessionId)?.intent || 'Untitled recording'}
                                </span>
                            </div>
                            {canEdit && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="flex h-6 w-6 items-center justify-center rounded-md text-foreground-muted/30 hover:text-foreground-muted hover:bg-background-secondary transition-colors">
                                            <MoreVertical className="h-3.5 w-3.5" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-44 rounded-lg shadow-xl border-border/40">
                                        <DropdownMenuItem onClick={onSyncTimings} className="gap-2 text-xs cursor-pointer m-0.5 rounded">
                                            <RefreshCw className="h-3.5 w-3.5 opacity-60" />
                                            Sync recording
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={onGenerateGifs}
                                            disabled={isGeneratingGifs}
                                            className="gap-2 text-xs cursor-pointer m-0.5 rounded"
                                        >
                                            <Play className={cn("h-3.5 w-3.5 opacity-60 fill-current", isGeneratingGifs && "animate-pulse")} />
                                            {isGeneratingGifs ? 'Generating…' : 'Generate GIFs'}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => onObserverSessionChange(null)}
                                            className="gap-2 text-xs text-destructive focus:text-destructive cursor-pointer m-0.5 rounded"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                            Unlink
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    ) : (
                        canEdit && (
                            <div className="mb-6">
                                <button
                                    onClick={toggleMediaLibrary}
                                    className="flex items-center gap-1.5 h-6 px-2 rounded-md text-[11px] font-medium text-foreground-muted/35 border border-dashed border-border/40 hover:border-border/70 hover:text-foreground-muted/60 transition-colors"
                                >
                                    <Video className="h-3 w-3 opacity-60" />
                                    Link video source
                                </button>
                            </div>
                        )
                    )}

                {/* Main Title */}
                <div className="mt-0">
                    <textarea
                        ref={titleRef}
                        value={title}
                        onChange={(e) => {
                            onTitleChange(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        placeholder={t('walkthroughTitlePlaceholder') || 'Untitled Walkthrough'}
                        rows={1}
                        className="w-full bg-transparent border-transparent outline-none focus:bg-transparent focus:border-transparent focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none shadow-none focus:shadow-none p-0 text-[40px] font-bold text-foreground leading-[1.2] resize-none overflow-hidden placeholder:text-foreground-muted/20 mb-2"
                    />
                </div>

                {/* Walkthrough Description */}
                <textarea
                    ref={descRef}
                    value={description || ''}
                    onChange={(e) => {
                        onDescriptionChange(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    placeholder={t('descriptionPlaceholder') || 'Add a description...'}
                    rows={1}
                    className="w-full bg-transparent border-transparent outline-none focus:bg-transparent focus:border-transparent focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none shadow-none focus:shadow-none p-0 text-[16px] text-foreground/80 dark:text-foreground-subtle/80 leading-[1.5] resize-none overflow-hidden placeholder:text-foreground-muted/20 mb-8"
                />

                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onDragEnd}
                >
                <SortableContext
                    items={steps.map(s => s.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <div className="space-y-0.5 font-sans">
                        {steps.map((step, index) => (
                            <SortableStepBlock
                                key={step.id}
                                projectId={projectId}
                                walkthroughId={walkthroughId}
                                step={step}
                                index={index}
                                canEdit={canEdit}
                                isFocused={index === selectedStepIndex}
                                videoUrl={videoUrl}
                                onUpdateStep={onUpdateStep}
                                onAddStep={onAddStep}
                                onRemoveStep={onRemoveStep}
                                onSelectStep={onSelectStep}
                                onCaptureCover={(stepId) => setCaptureStepId(stepId)}
                                t={t}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>

            {/* Add Step Button (Notion style) */}
            {canEdit && (
                <button
                    onClick={() => onAddStep()}
                    className="flex items-center gap-2 w-full pl-[52px] pr-3 py-1.5 mt-1 text-foreground-muted/25 hover:text-foreground-muted/60 rounded-md transition-all duration-150 group"
                >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="text-[14px]">{t('addStep')}</span>
                </button>
            )}

            {/* Global Walkthrough Discussion Section */}
            <div className="mt-16 pt-8 border-t border-border/20">
                <button 
                    onClick={() => setIsCommentsExpanded(!isCommentsExpanded)}
                    className="flex items-center gap-2 mb-6 text-foreground-muted hover:text-foreground transition-colors group/disc"
                >
                    {isCommentsExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 opacity-50 group-hover/disc:opacity-100" />
                    ) : (
                        <ChevronRight className="h-3.5 w-3.5 opacity-50 group-hover/disc:opacity-100" />
                    )}
                    <MessageSquare className="h-4 w-4" />
                    <h3 className="text-[12px] font-bold uppercase tracking-[0.15em]">{t('discussion')}</h3>
                </button>

                {isCommentsExpanded && (
                    <div className="px-1">
                        <CommentsPanel 
                            projectId={projectId}
                            walkthroughId={walkthroughId}
                            showHeader={false}
                            className="bg-transparent"
                            canComment={canEdit}
                            steps={steps.map((s, idx) => ({ id: s.id, title: s.title || `${t('step') || 'Step'} ${idx + 1}`, index: idx + 1 }))}
                        />
                    </div>
                )}
            </div>
        </div>

            {/* Step Cover Capture Modal */}
            {captureStep && (
                <StepCoverCaptureModal
                    open={Boolean(captureStepId)}
                    onOpenChange={(open) => { if (!open) setCaptureStepId(null); }}
                    walkthroughId={walkthroughId}
                    stepId={captureStep.id}
                    stepTitle={captureStep.title}
                    videoUrl={videoUrl}
                    startMs={captureStep.startMs ?? 0}
                    endMs={captureStep.endMs ?? Math.round((videoDurationMs ?? 10000) / 2)}
                    videoDurationMs={videoDurationMs}
                    onSuccess={(gifUrl, newStartMs, newEndMs) => {
                        const idx = steps.findIndex((s) => s.id === captureStep.id);
                        if (idx !== -1) {
                            onUpdateStep(idx, 'gifUrl', gifUrl);
                            onUpdateStep(idx, 'coverUrl', null);
                            onUpdateStep(idx, 'startMs', newStartMs);
                            onUpdateStep(idx, 'endMs', newEndMs);
                        }
                        setCaptureStepId(null);
                    }}
                />
            )}

            {/* Cover Picker Modal */}
            <CoverPickerModal
                open={coverPickerOpen}
                onOpenChange={setCoverPickerOpen}
                projectId={projectId}
                walkthroughId={walkthroughId}
                observerSessionId={observerSessionId}
                onSelect={(url) => onCoverChange(url)}
            />
    </div>
    );
}
