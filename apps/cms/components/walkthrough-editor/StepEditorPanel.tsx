'use client';

import React from 'react';
import { Step, Walkthrough } from '@luma/infra';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ChevronUp, ChevronDown, Copy, Trash2, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CommentsPanel } from '@/components/comments';

interface StepEditorPanelProps {
    step: Step;
    stepIndex: number;
    totalSteps: number;
    projectId: string;
    walkthroughId: string;
    canEdit: boolean;
    stepTitleRef: React.RefObject<HTMLInputElement | null>;
    onUpdateStep: (index: number, field: keyof Step, value: any) => void;
    onMoveStep: (index: number, direction: 'up' | 'down') => void;
    onDuplicateStep: () => void;
    onRemoveStep: () => void;
}

export const StepEditorPanel = React.memo(function StepEditorPanel({
    step,
    stepIndex,
    totalSteps,
    projectId,
    walkthroughId,
    canEdit,
    stepTitleRef,
    onUpdateStep,
    onMoveStep,
    onDuplicateStep,
    onRemoveStep,
}: StepEditorPanelProps) {
    const t = useTranslations('Editor');
    const tc = useTranslations('Common');

    return (
        <div className="flex-1 flex flex-col">
            {/* Step header — section label + nav */}
            <div className="flex items-center justify-between gap-2 mb-3">
                <div className="min-w-0">
                    <h2 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">{t('stepStyling')}</h2>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-foreground-muted tabular-nums">
                        {stepIndex + 1}/{totalSteps}
                    </span>
                    <div className="flex border border-border rounded overflow-hidden">
                        <button onClick={() => onMoveStep(stepIndex, 'up')} disabled={stepIndex === 0} className="p-1 bg-background hover:bg-background-secondary disabled:opacity-40 disabled:cursor-not-allowed border-r border-border">
                            <ChevronUp className="h-3 w-3 text-foreground-muted" />
                        </button>
                        <button onClick={() => onMoveStep(stepIndex, 'down')} disabled={stepIndex === totalSteps - 1} className="p-1 bg-background hover:bg-background-secondary disabled:opacity-40 disabled:cursor-not-allowed">
                            <ChevronDown className="h-3 w-3 text-foreground-muted" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Two-column layout: content left, properties right */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr,280px] gap-6 flex-1">
                {/* Left column — Title + Content */}
                <div className="min-w-0 flex flex-col">
                    {/* Step title */}
                    <div className="relative flex items-center group mb-2">
                        <Pencil className="h-3 w-3 absolute -left-4.5 text-foreground-muted/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none hidden lg:block" />
                        <input
                            ref={stepTitleRef}
                            value={step.title}
                            onChange={e => onUpdateStep(stepIndex, 'title', e.target.value)}
                            className="w-full text-base font-semibold bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus:border-none px-0 shadow-none placeholder:text-foreground-muted/50 text-foreground transition-none cursor-text"
                            placeholder={t('stepTitlePlaceholder')}
                        />
                    </div>

                    {/* Step content */}
                    <textarea
                        className="w-full p-0 bg-transparent border-none outline-none focus:outline-none text-foreground resize-y min-h-[120px] focus:ring-0 text-sm leading-relaxed placeholder:text-foreground-muted/50 flex-1"
                        value={step.content}
                        onChange={e => onUpdateStep(stepIndex, 'content', e.target.value)}
                        placeholder={t('stepContentPlaceholder')}
                    />

                </div>

                {/* Right column — Properties + Actions */}
                <div className="border-t lg:border-t-0 lg:border-l border-border/30 pt-3 lg:pt-0 lg:pl-6 space-y-3">
                    {/* Target Element */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider">{t('targetElement')}</label>
                        <Input
                            className="font-mono text-xs bg-background-secondary/50 border-transparent focus:bg-background focus:border-border/50 h-7 px-2 rounded-sm transition-all placeholder:text-foreground-subtle"
                            value={step.target || ''}
                            onChange={e => onUpdateStep(stepIndex, 'target', e.target.value)}
                            placeholder={t('targetPlaceholder')}
                        />
                    </div>

                    {/* Placement */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider">{t('placement')}</label>
                        <Select
                            value={step.placement || 'auto'}
                            onValueChange={(value) => onUpdateStep(stepIndex, 'placement', value)}
                        >
                            <SelectTrigger className="w-full h-7 px-2 rounded-sm bg-background-secondary/50 border-transparent text-xs focus:ring-0 focus:bg-background focus:border-border/50">
                                <SelectValue placeholder={t('selectPlacement')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="auto">{t('automatic')}</SelectItem>

                                <SelectGroup>
                                    <SelectLabel>{t('top')}</SelectLabel>
                                    <SelectItem value="top">{t('top')}</SelectItem>
                                    <SelectItem value="top-start">{t('topStart')}</SelectItem>
                                    <SelectItem value="top-end">{t('topEnd')}</SelectItem>
                                </SelectGroup>

                                <SelectGroup>
                                    <SelectLabel>{t('bottom')}</SelectLabel>
                                    <SelectItem value="bottom">{t('bottom')}</SelectItem>
                                    <SelectItem value="bottom-start">{t('bottomStart')}</SelectItem>
                                    <SelectItem value="bottom-end">{t('bottomEnd')}</SelectItem>
                                </SelectGroup>

                                <SelectGroup>
                                    <SelectLabel>{t('right')}</SelectLabel>
                                    <SelectItem value="right">{t('right')}</SelectItem>
                                    <SelectItem value="right-start">{t('rightStart')}</SelectItem>
                                    <SelectItem value="right-end">{t('rightEnd')}</SelectItem>
                                </SelectGroup>

                                <SelectGroup>
                                    <SelectLabel>{t('left')}</SelectLabel>
                                    <SelectItem value="left">{t('left')}</SelectItem>
                                    <SelectItem value="left-start">{t('leftStart')}</SelectItem>
                                    <SelectItem value="left-end">{t('leftEnd')}</SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1 border-t border-border/30 pt-2.5">
                        <Button
                            onClick={onDuplicateStep}
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-foreground-muted hover:text-foreground hover:bg-background-secondary/50 gap-1.5 justify-start"
                        >
                            <Copy className="h-3 w-3 opacity-70" />
                            {t('duplicateStep')}
                        </Button>

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-foreground-muted hover:text-red-400 hover:bg-red-500/5 gap-1.5 justify-start"
                                >
                                    <Trash2 className="h-3 w-3 opacity-70" />
                                    {t('deleteStep')}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>{t('deleteStepConfirm')}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        {t('deleteStepDescription')}
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={onRemoveStep}
                                        className="bg-red-600 hover:bg-red-700"
                                    >
                                        {tc('delete')}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            </div>

            {/* Inline Comments - Full Width */}
            {walkthroughId && walkthroughId !== 'new' && (
                <div className="mt-8 border-t border-border pt-6">
                    <h3 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-4 px-1">{t('discussion')}</h3>
                    <CommentsPanel
                        projectId={projectId}
                        walkthroughId={walkthroughId}
                        stepId={step.id}
                        showHeader={false}
                        canComment={canEdit}
                        className="py-2"
                    />
                </div>
            )}
        </div >
    );
});

