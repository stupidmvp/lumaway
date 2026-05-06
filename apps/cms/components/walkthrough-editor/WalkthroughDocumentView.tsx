'use client';

import React from 'react';
import { Step } from '@luma/infra';
import { useTranslations } from 'next-intl';
import { Hash, Plus, GripVertical, MoreVertical, Trash2, Smile, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
    title: string;
    description: string | null;
    steps: Step[];
    canEdit: boolean;
    onTitleChange: (title: string) => void;
    onDescriptionChange: (description: string) => void;
    onUpdateStep: (index: number, field: keyof Step, value: any) => void;
    onAddStep: (index?: number) => void;
    onRemoveStep: (index: number) => void;
    onDragEnd: (event: DragEndEvent) => void;
    sensors: SensorDescriptor<SensorOptions>[];
    selectedStepIndex: number;
}

interface SortableStepBlockProps {
    step: Step;
    index: number;
    canEdit: boolean;
    isFocused: boolean;
    onUpdateStep: (index: number, field: keyof Step, value: any) => void;
    onAddStep: (index?: number) => void;
    onRemoveStep: (index: number) => void;
    t: any;
}

function SortableStepBlock({ step, index, canEdit, isFocused, onUpdateStep, onAddStep, onRemoveStep, t }: SortableStepBlockProps) {
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
            className={cn(
                "group relative flex flex-col rounded-lg px-4 py-2.5 transition-all duration-200",
                isFocused 
                    ? "bg-accent-blue/[0.05] dark:bg-accent-blue/[0.08]" 
                    : "hover:bg-background-secondary/40",
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
                            "flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 text-[17px] font-bold tracking-tight transition-all placeholder:text-foreground-muted/30",
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
                            "w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 text-[15.5px] text-foreground/70 dark:text-foreground-subtle/90 leading-relaxed resize-none overflow-hidden transition-all placeholder:text-foreground-muted/20",
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
    title, 
    description, 
    steps, 
    canEdit, 
    onTitleChange,
    onDescriptionChange,
    onUpdateStep, 
    onAddStep, 
    onRemoveStep, 
    onDragEnd, 
    sensors, 
    selectedStepIndex 
}: WalkthroughDocumentViewProps) {
    const t = useTranslations('Editor');
    const titleRef = React.useRef<HTMLTextAreaElement>(null);
    const descRef = React.useRef<HTMLTextAreaElement>(null);

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

    if (!steps) {
        return null;
    }

    return (
        <div className="py-12 px-8 max-w-[850px] mx-auto w-full min-h-full">
            {/* Notion-style Page Header */}
            <div className="mb-10 group/header">
                {/* Actions (Icon/Cover) */}
                <div className="flex items-center gap-4 mb-4 opacity-0 group-hover/header:opacity-100 transition-opacity">
                    <button className="flex items-center gap-1.5 text-xs font-medium text-foreground-muted/60 hover:text-foreground transition-colors">
                        <Smile className="h-3.5 w-3.5" />
                        <span>{t('addIcon') || 'Add icon'}</span>
                    </button>
                    <button className="flex items-center gap-1.5 text-xs font-medium text-foreground-muted/60 hover:text-foreground transition-colors">
                        <ImageIcon className="h-3.5 w-3.5" />
                        <span>{t('addCover') || 'Add cover'}</span>
                    </button>
                </div>

                {/* Main Title */}
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
                    className="w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 text-[40px] font-bold text-foreground leading-[1.2] resize-none overflow-hidden placeholder:text-foreground-muted/20 mb-2"
                />

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
                    className="w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 text-[16px] text-foreground/80 dark:text-foreground-subtle/80 leading-[1.5] resize-none overflow-hidden placeholder:text-foreground-muted/20"
                />
            </div>

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
                                step={step}
                                index={index}
                                canEdit={canEdit}
                                isFocused={index === selectedStepIndex}
                                onUpdateStep={onUpdateStep}
                                onAddStep={onAddStep}
                                onRemoveStep={onRemoveStep}
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
        </div>
    );
}
