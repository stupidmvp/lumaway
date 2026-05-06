'use client';

import React from 'react';
import { Step } from '@luma/infra';
import { useTranslations } from 'next-intl';
import { Hash, Plus, GripVertical, MoreVertical, Trash2, Smile, Image as ImageIcon, MessageSquare, ChevronDown, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
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
    description: string | null;
    steps: Step[];
    canEdit: boolean;
    onTitleChange: (title: string) => void;
    onIconChange: (icon: string | null) => void;
    onCoverChange: (coverUrl: string | null) => void;
    onDescriptionChange: (description: string) => void;
    onUpdateStep: (index: number, field: keyof Step, value: any) => void;
    onAddStep: (index?: number) => void;
    onRemoveStep: (index: number) => void;
    onDragEnd: (event: DragEndEvent) => void;
    sensors: SensorDescriptor<SensorOptions>[];
    selectedStepIndex: number;
    onSelectStep: (index: number) => void;
}
interface SortableStepBlockProps {
    projectId: string;
    walkthroughId: string;
    step: Step;
    index: number;
    canEdit: boolean;
    isFocused: boolean;
    onUpdateStep: (index: number, field: keyof Step, value: any) => void;
    onAddStep: (index?: number) => void;
    onRemoveStep: (index: number) => void;
    onSelectStep: (index: number) => void;
    t: any;
}

function SortableStepBlock({ 
    projectId,
    walkthroughId,
    step, 
    index, 
    canEdit, 
    isFocused, 
    onUpdateStep, 
    onAddStep, 
    onRemoveStep, 
    onSelectStep, 
    t 
}: SortableStepBlockProps) {
    const inputRef = React.useRef<HTMLInputElement>(null);

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
                "group relative flex flex-col rounded-lg px-4 py-2.5 transition-colors duration-200 cursor-pointer outline-none focus:outline-none focus-visible:outline-none",
                isFocused 
                    ? "bg-accent-blue/[0.03] dark:bg-accent-blue/[0.05]" 
                    : "hover:bg-background-secondary/30",
                isDragging ? "opacity-50 z-50 bg-background border border-border shadow-md" : "opacity-100"
            )}
        >
            {/* Notion-style Block Drag Handle & Add Button */}
            <div className={cn(
                "absolute -left-[48px] top-3 transition-all duration-200 flex items-center gap-0.5",
                isFocused ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}>
                {canEdit && (
                    <button
                        onClick={() => onAddStep(index + 1)}
                        className="p-1 rounded hover:bg-background-secondary text-foreground-muted/20 hover:text-foreground-muted transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                )}
                <div 
                    ref={setActivatorNodeRef}
                    {...attributes}
                    {...listeners}
                    className={cn(
                        "flex cursor-grab active:cursor-grabbing items-center justify-center p-1 rounded transition-colors",
                        isFocused 
                            ? "text-accent-blue" 
                            : "text-foreground-muted/20 hover:text-foreground-muted",
                        !canEdit && "pointer-events-none"
                    )}
                >
                    <GripVertical className="h-4 w-4" />
                </div>
            </div>

            <div className="flex flex-col gap-1">
                {/* Step Title */}
                <div className="flex items-center gap-3">
                    <input
                        ref={inputRef}
                        value={step.title || ''}
                        onChange={(e) => canEdit && onUpdateStep(index, 'title', e.target.value)}
                        readOnly={!canEdit}
                        placeholder={t('untitledStep')}
                        className={cn(
                            "flex-1 bg-transparent border-transparent outline-none focus:bg-transparent focus:border-transparent focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none shadow-none focus:shadow-none p-0 text-[17px] font-bold tracking-tight placeholder:text-foreground-muted/30",
                            isFocused ? "text-foreground" : "text-foreground/90",
                            canEdit ? "cursor-text" : "cursor-default"
                        )}
                    />
                </div>
                
                {/* Step Description */}
                <div className="">
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
                            "mt-2 inline-flex items-center gap-1.5 px-0 text-foreground-muted/60 transition-opacity duration-200",
                            isFocused ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        )}>
                            <Hash className="h-3 w-3" />
                            <code className="text-[11px] font-mono font-medium truncate max-w-[400px]">{step.target}</code>
                        </div>
                    )}
                </div>
            </div>

            {/* Actions Menu */}
            {canEdit && (
                <div className={cn(
                    "absolute top-3 right-3 transition-opacity duration-200",
                    isFocused ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}>
                    <AlertDialog>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="p-1 rounded hover:bg-background-secondary text-foreground-muted/20 hover:text-foreground-muted transition-colors">
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
        </div>
    );
}

export function WalkthroughDocumentView({ 
    projectId,
    walkthroughId,
    title, 
    icon,
    coverUrl,
    description, 
    steps, 
    canEdit, 
    onTitleChange,
    onIconChange,
    onCoverChange,
    onDescriptionChange,
    onUpdateStep, 
    onAddStep, 
    onRemoveStep, 
    onDragEnd, 
    sensors, 
    selectedStepIndex,
    onSelectStep
}: WalkthroughDocumentViewProps) {
    const t = useTranslations('Editor');
    const { theme } = useTheme();
    const titleRef = React.useRef<HTMLTextAreaElement>(null);
    const descRef = React.useRef<HTMLTextAreaElement>(null);
    const [isCommentsExpanded, setIsCommentsExpanded] = React.useState(true);

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
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="secondary" size="sm" className="bg-background/80 backdrop-blur-md border-none text-xs h-7 hover:bg-background/90 transition-all shadow-sm">
                                                Change cover
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-64 p-4">
                                            <FileUpload 
                                                s3Type="walkthrough-cover"
                                                uploadPath={`projects/${projectId}/walkthroughs/${walkthroughId}/cover`}
                                                onUploadSuccess={(files) => {
                                                    if (files[0]?.fileUrl) onCoverChange(files[0].fileUrl);
                                                }}
                                                showDropzone={true}
                                                placeholder="Upload new cover"
                                            />
                                        </DropdownMenuContent>
                                    </DropdownMenu>
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
                                     <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button className="text-[14px] font-medium text-foreground-muted/60 hover:text-foreground flex items-center gap-1.5 transition-colors">
                                                <ImageIcon className="h-4 w-4" />
                                                Add cover
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" className="w-64 p-4">
                                            <FileUpload 
                                                s3Type="walkthrough-cover"
                                                uploadPath={`projects/${projectId}/walkthroughs/${walkthroughId}/cover`}
                                                onUploadSuccess={(files) => {
                                                    if (files[0]?.fileUrl) onCoverChange(files[0].fileUrl);
                                                }}
                                                showDropzone={true}
                                                placeholder="Upload cover image"
                                            />
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>
                        )
                    )}
                </div>

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
                    <div className="space-y-1 font-sans">
                        {steps.map((step, index) => (
                            <SortableStepBlock
                                key={step.id}
                                projectId={projectId}
                                walkthroughId={walkthroughId}
                                step={step}
                                index={index}
                                canEdit={canEdit}
                                isFocused={index === selectedStepIndex}
                                onUpdateStep={onUpdateStep}
                                onAddStep={onAddStep}
                                onRemoveStep={onRemoveStep}
                                onSelectStep={onSelectStep}
                                t={t}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>

            {/* Add Step Button (Notion style) */}
            {canEdit && (
                <button
                    onClick={onAddStep}
                    className="flex items-center gap-2 w-full px-2 py-2 mt-2 text-foreground-muted/40 hover:text-foreground-muted hover:bg-background-secondary/40 rounded-md transition-all duration-200 group"
                >
                    <Plus className="h-4 w-4 opacity-50 group-hover:opacity-100" />
                    <span className="text-[15px]">{t('addStep')}</span>
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
    </div>
    );
}
