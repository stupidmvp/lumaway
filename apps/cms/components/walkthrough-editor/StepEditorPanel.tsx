'use client';

import React from 'react';
import { Step, Walkthrough, useProject, DEFAULT_PROJECT_SETTINGS } from '@luma/infra';
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
import { ChevronUp, ChevronDown, Copy, Trash2, Pencil, Plus, Component, X, GripVertical, Sparkles, AlertCircle, Bot } from 'lucide-react';

import { useTranslations } from 'next-intl';
import { AiContextDrawer } from './AiContextDrawer';

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
    const { data: project } = useProject(projectId);

    // Merge with defaults to ensure we have values during loading or for new projects
    const settings = React.useMemo(() => ({
        ...DEFAULT_PROJECT_SETTINGS,
        ...(project?.settings ?? {}),
    }), [project?.settings]);

    const [focusNewKey, setFocusNewKey] = React.useState<string | null>(null);

    const isPlainObject = React.useCallback((value: unknown): value is Record<string, any> => {
        return Object.prototype.toString.call(value) === '[object Object]';
    }, []);

    const renderObjectFields = React.useCallback((
        objectValue: Record<string, any>,
        onObjectChange: (nextObject: Record<string, any>) => void,
        depth: number = 0
    ): React.ReactNode => {
        const entries = Object.entries(objectValue || {});

        return (
            <div className="space-y-1.5">
                {entries.map(([childKey, childValue], childIndex) => {
                    const childIsObject = isPlainObject(childValue);
                    const childIsArray = Array.isArray(childValue);

                    return (
                        <div key={`${depth}-${childKey}-${childIndex}`} className="space-y-1.5">
                            <div className="flex items-center gap-1.5 group">
                                <Input
                                    className="font-mono text-[10px] bg-background-secondary/30 h-6 px-1.5 rounded-sm border-transparent focus:border-border/50 transition-all placeholder:text-foreground-subtle/50 flex-[0.8]"
                                    value={childKey}
                                    onChange={(e) => {
                                        const nextObject = { ...objectValue };
                                        const newKey = e.target.value;
                                        if (newKey !== childKey) {
                                            delete nextObject[childKey];
                                            nextObject[newKey] = childValue;
                                            onObjectChange(nextObject);
                                        }
                                    }}
                                    placeholder="Key"
                                />
                                <span className="text-foreground-muted/30 text-[10px]">:</span>

                                {!childIsObject && !childIsArray && (
                                    <Input
                                        className="font-mono text-[10px] bg-background-secondary/30 h-6 px-1.5 rounded-sm border-transparent focus:border-border/50 transition-all placeholder:text-foreground-subtle/50 flex-1"
                                        value={childValue == null ? '' : String(childValue)}
                                        onChange={(e) => {
                                            const nextObject = { ...objectValue };
                                            nextObject[childKey] = e.target.value;
                                            onObjectChange(nextObject);
                                        }}
                                        placeholder="Value"
                                    />
                                )}

                                {(childIsObject || childIsArray) && (
                                    <div className="font-mono text-[10px] text-foreground-muted px-1.5 h-6 flex items-center rounded-sm bg-background-secondary/30 border border-transparent flex-1">
                                        {childIsObject
                                            ? `Object (${Object.keys(childValue as Record<string, any>).length})`
                                            : `Array (${(childValue as unknown[]).length})`}
                                    </div>
                                )}

                                <button
                                    onClick={() => {
                                        const nextObject = { ...objectValue };
                                        delete nextObject[childKey];
                                        onObjectChange(nextObject);
                                    }}
                                    className="p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 hover:text-red-500 rounded text-foreground-muted"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>

                            {childIsObject && (
                                <details className="ml-2 rounded-sm border border-border/40 bg-background-secondary/20 p-2">
                                    <summary className="cursor-pointer text-[10px] text-foreground-muted select-none">
                                        Ver atributos
                                    </summary>
                                    <div className="mt-2">
                                        {renderObjectFields(
                                            childValue as Record<string, any>,
                                            (nextChildObject) => {
                                                const nextObject = { ...objectValue };
                                                nextObject[childKey] = nextChildObject;
                                                onObjectChange(nextObject);
                                            },
                                            depth + 1
                                        )}
                                    </div>
                                </details>
                            )}

                            {childIsArray && (
                                <details className="ml-2 rounded-sm border border-border/40 bg-background-secondary/20 p-2">
                                    <summary className="cursor-pointer text-[10px] text-foreground-muted select-none">
                                        Ver contenido
                                    </summary>
                                    <pre className="mt-2 text-[10px] font-mono text-foreground-muted whitespace-pre-wrap break-all">
                                        {JSON.stringify(childValue, null, 2)}
                                    </pre>
                                </details>
                            )}
                        </div>
                    );
                })}

                <Button
                    onClick={() => {
                        const nextObject = { ...objectValue };
                        const newKey = `property_${Object.keys(nextObject).length + 1}`;
                        nextObject[newKey] = '';
                        onObjectChange(nextObject);
                    }}
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px] text-foreground-muted hover:bg-background-secondary/50"
                >
                    <Plus className="h-3 w-3 mr-1" />
                    Add property
                </Button>
            </div>
        );
    }, [isPlainObject]);

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
                        value={step.description}
                        onChange={e => onUpdateStep(stepIndex, 'description', e.target.value)}
                        placeholder={t('stepContentPlaceholder')}
                    />

                </div>

                <div className="border-t lg:border-t-0 lg:border-l border-border/30 pt-3 lg:pt-0 lg:pl-6 space-y-3">
                    {/* AI Context Section */}
                    {settings.assistantEnabled && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider">{t('aiContext')}</label>
                            <AiContextDrawer
                                purpose={step.purpose || ''}
                                onUpdatePromise={(val) => onUpdateStep(stepIndex, 'purpose', val)}
                                trigger={
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full h-8 px-2 text-xs text-foreground-muted hover:text-primary hover:bg-primary/5 hover:border-primary/30 gap-2 justify-start border-dashed border-border/60"
                                    >
                                        <Bot className="h-3.5 w-3.5 opacity-70" />
                                        <span className="truncate flex-1 text-left font-normal">
                                            {step.purpose ? step.purpose : t('aiContextPlaceholder')}
                                        </span>
                                    </Button>
                                }
                            />
                        </div>
                    )}

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
                            <SelectTrigger className="w-full h-7 px-2 rounded-sm bg-background-secondary/50 border-transparent text-xs transition-all hover:bg-background-secondary hover:border-border/50 focus:ring-2 focus:ring-ring focus:ring-offset-0 focus:bg-background focus:border-border/50 cursor-pointer">
                                <SelectValue placeholder={t('selectPlacement')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="auto">{t('automatic')}</SelectItem>

                                <SelectGroup>
                                    <SelectItem value="top">{t('top')}</SelectItem>
                                    <SelectItem value="top-start">{t('topStart')}</SelectItem>
                                    <SelectItem value="top-end">{t('topEnd')}</SelectItem>
                                </SelectGroup>

                                <SelectGroup>
                                    <SelectItem value="bottom">{t('bottom')}</SelectItem>
                                    <SelectItem value="bottom-start">{t('bottomStart')}</SelectItem>
                                    <SelectItem value="bottom-end">{t('bottomEnd')}</SelectItem>
                                </SelectGroup>

                                <SelectGroup>
                                    <SelectItem value="right">{t('right')}</SelectItem>
                                    <SelectItem value="right-start">{t('rightStart')}</SelectItem>
                                    <SelectItem value="right-end">{t('rightEnd')}</SelectItem>
                                </SelectGroup>

                                <SelectGroup>
                                    <SelectItem value="left">{t('left')}</SelectItem>
                                    <SelectItem value="left-start">{t('leftStart')}</SelectItem>
                                    <SelectItem value="left-end">{t('leftEnd')}</SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Metadata Section */}
                    <div className="space-y-1 pt-2 border-t border-border/30">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider flex items-center gap-1">
                                <Component className="h-3 w-3" />
                                {t('metadata')}
                            </label>
                            <Button
                                onClick={() => {
                                    const currentMeta = step.metadata || {};
                                    const newKey = `property_${Object.keys(currentMeta).length + 1}`;
                                    onUpdateStep(stepIndex, 'metadata', {
                                        ...currentMeta,
                                        [newKey]: ''
                                    });
                                    setFocusNewKey(newKey);
                                }}
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 hover:bg-background-secondary/50"
                            >
                                <Plus className="h-3 w-3 text-foreground-muted" />
                            </Button>
                        </div>

                        <div className="space-y-1.5">
                            {Object.entries(step.metadata || {}).map(([key, value], i) => (
                                <div key={i} className="space-y-1.5">
                                    <div className="flex items-center gap-1.5 group">
                                        <Input
                                            ref={el => {
                                                if (el && focusNewKey === key) {
                                                    el.focus();
                                                    setTimeout(() => el.select(), 0);
                                                    setFocusNewKey(null);
                                                }
                                            }}
                                            className="font-mono text-[10px] bg-background-secondary/30 h-6 px-1.5 rounded-sm border-transparent focus:border-border/50 transition-all placeholder:text-foreground-subtle/50 flex-[0.8]"
                                            value={key}
                                            onChange={(e) => {
                                                const newMeta = { ...(step.metadata || {}) };
                                                const newKey = e.target.value;
                                                if (newKey !== key) {
                                                    delete newMeta[key];
                                                    newMeta[newKey] = value;
                                                    onUpdateStep(stepIndex, 'metadata', newMeta);
                                                }
                                            }}
                                            placeholder="Key"
                                        />
                                        <span className="text-foreground-muted/30 text-[10px]">:</span>
                                        {isPlainObject(value) ? (
                                            <div className="font-mono text-[10px] text-foreground-muted px-1.5 h-6 flex items-center rounded-sm bg-background-secondary/30 border border-transparent flex-1">
                                                {`Object (${Object.keys(value).length})`}
                                            </div>
                                        ) : (
                                            <Input
                                                className="font-mono text-[10px] bg-background-secondary/30 h-6 px-1.5 rounded-sm border-transparent focus:border-border/50 transition-all placeholder:text-foreground-subtle/50 flex-1"
                                                value={value == null ? '' : String(value)}
                                                onChange={(e) => {
                                                    const newMeta = { ...(step.metadata || {}) };
                                                    newMeta[key] = e.target.value;
                                                    onUpdateStep(stepIndex, 'metadata', newMeta);
                                                }}
                                                placeholder="Value"
                                            />
                                        )}
                                        <button
                                            onClick={() => {
                                                const newMeta = { ...(step.metadata || {}) };
                                                delete newMeta[key];
                                                onUpdateStep(stepIndex, 'metadata', newMeta);
                                            }}
                                            className="p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 hover:text-red-500 rounded text-foreground-muted"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>

                                    {isPlainObject(value) && (
                                        <details className="ml-2 rounded-sm border border-border/40 bg-background-secondary/20 p-2">
                                            <summary className="cursor-pointer text-[10px] text-foreground-muted select-none">
                                                Ver atributos
                                            </summary>
                                            <div className="mt-2">
                                                {renderObjectFields(value, (nextObjectValue) => {
                                                    const newMeta = { ...(step.metadata || {}) };
                                                    newMeta[key] = nextObjectValue;
                                                    onUpdateStep(stepIndex, 'metadata', newMeta);
                                                })}
                                            </div>
                                        </details>
                                    )}
                                </div>
                            ))}
                            {Object.keys(step.metadata || {}).length === 0 && (
                                <div className="text-[10px] text-foreground-muted/40 italic px-1">
                                    {t('noMetadata')}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1 border-t border-border/30 pt-2.5">


                        <Button
                            onClick={onDuplicateStep}
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-foreground-muted hover:text-foreground hover:bg-background-secondary/50 gap-2 justify-start w-full"
                        >
                            <Copy className="h-3.5 w-3.5 opacity-70" />
                            {t('duplicateStep')}
                        </Button>

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-foreground-muted hover:text-destructive hover:bg-destructive/10 gap-2 justify-start w-full"
                                >
                                    <Trash2 className="h-3.5 w-3.5 opacity-70" />
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
