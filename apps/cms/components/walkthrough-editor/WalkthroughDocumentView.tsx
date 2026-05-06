'use client';

import React from 'react';
import { Step } from '@luma/infra';
import { useTranslations } from 'next-intl';
import { Hash, Plus, GripVertical, MoreVertical, Trash2 } from 'lucide-react';
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
    steps: Step[];
    canEdit: boolean;
    onUpdateStep: (index: number, field: keyof Step, value: any) => void;
    onAddStep: () => void;
    onRemoveStep: (index: number) => void;
    onDragEnd: (event: DragEndEvent) => void;
    sensors: SensorDescriptor<SensorOptions>[];
}

interface SortableStepBlockProps {
    step: Step;
    index: number;
    canEdit: boolean;
    onUpdateStep: (index: number, field: keyof Step, value: any) => void;
    onRemoveStep: (index: number) => void;
    t: any;
}

function SortableStepBlock({ step, index, canEdit, onUpdateStep, onRemoveStep, t }: SortableStepBlockProps) {
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
                "group relative flex flex-col gap-1 rounded-md px-2 py-1 hover:bg-background-secondary/40 transition-colors duration-200",
                isDragging ? "opacity-50 z-50 bg-background shadow-lg ring-1 ring-border" : "opacity-100"
            )}
        >
            {/* Notion-style Block Drag Handle */}
            <div 
                ref={setActivatorNodeRef}
                {...attributes}
                {...listeners}
                className={cn(
                    "absolute -left-6 top-1 opacity-0 group-hover:opacity-100 transition-opacity flex cursor-grab active:cursor-grabbing items-center justify-center text-foreground-muted/40 hover:text-foreground-muted px-1 py-1 rounded",
                    !canEdit && "pointer-events-none"
                )}
            >
                <GripVertical className="h-4 w-4" />
            </div>

            {/* Step Title (H3 style in Notion) */}
            <div className="flex items-start gap-2">
                <input
                    value={step.title || ''}
                    onChange={(e) => canEdit && onUpdateStep(index, 'title', e.target.value)}
                    readOnly={!canEdit}
                    placeholder={t('untitledStep')}
                    className={cn(
                        "flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 text-[16px] font-semibold text-foreground leading-snug placeholder:text-foreground-muted/30",
                        canEdit ? "cursor-text" : "cursor-default"
                    )}
                />
            </div>
            
            {/* Step Content */}
            <div className="pl-0">
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
                        "w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 text-[15px] text-foreground-subtle leading-[1.6] resize-none overflow-hidden placeholder:text-foreground-muted/20",
                        canEdit ? "cursor-text" : "cursor-default"
                    )}
                />

                {/* Technical Target - Kept subtle */}
                {step.target && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-background-secondary/50 text-[11px] text-foreground-muted opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Hash className="h-3 w-3" />
                        <code className="font-mono text-[10px] truncate max-w-[300px]">{step.target}</code>
                    </div>
                )}
            </div>

            {/* Actions Menu */}
            {canEdit && (
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <AlertDialog>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="p-1 rounded hover:bg-background-tertiary text-foreground-muted/40 hover:text-foreground-muted transition-colors">
                                    <MoreVertical className="h-4 w-4" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem className="text-destructive focus:text-destructive gap-2 cursor-pointer">
                                        <Trash2 className="h-4 w-4" />
                                        <span>{t('deleteStep')}</span>
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>{t('deleteStepConfirmTitle') || 'Delete Step?'}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {t('deleteStepConfirmDescription') || 'This action cannot be undone. This step will be permanently removed from the walkthrough.'}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>{t('cancel') || 'Cancel'}</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => onRemoveStep(index)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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

export function WalkthroughDocumentView({ steps, canEdit, onUpdateStep, onAddStep, onRemoveStep, onDragEnd, sensors }: WalkthroughDocumentViewProps) {
    const t = useTranslations('Editor');

    if (!steps || steps.length === 0) {
        return null;
    }

    return (
        <div className="py-8 px-2 max-w-[900px] mx-auto w-full">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
            >
                <SortableContext
                    items={steps.map(s => s.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <div className="space-y-6 font-sans">
                        {steps.map((step, index) => (
                            <SortableStepBlock
                                key={step.id}
                                step={step}
                                index={index}
                                canEdit={canEdit}
                                onUpdateStep={onUpdateStep}
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
                    className="flex items-center gap-2 w-full px-2 py-2 mt-4 text-foreground-muted/50 hover:text-foreground-muted hover:bg-background-secondary/40 rounded-md transition-all duration-200 group"
                >
                    <div className="w-5 h-5 flex items-center justify-center rounded bg-transparent border border-dashed border-foreground-muted/30 group-hover:border-foreground-muted/50">
                        <Plus className="h-3 w-3" />
                    </div>
                    <span className="text-sm font-medium">{t('addStep')}</span>
                </button>
            )}
        </div>
    );
}
