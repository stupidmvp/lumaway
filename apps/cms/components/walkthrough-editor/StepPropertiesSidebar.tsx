'use client';

import React, { useState, useCallback } from 'react';
import { Step } from '@luma/infra';
import { useTranslations } from 'next-intl';
import { Bot, Hash, Layout, Component, Plus, X, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface StepPropertiesSidebarProps {
    step: Step | null;
    stepIndex: number;
    projectId: string;
    canEdit: boolean;
    onUpdateStep: (index: number, field: keyof Step, value: any) => void;
}

export const StepPropertiesSidebar = React.memo(function StepPropertiesSidebar({
    step,
    stepIndex,
    projectId,
    canEdit,
    onUpdateStep,
}: StepPropertiesSidebarProps) {
    const t = useTranslations('Editor');
    const [focusNewKey, setFocusNewKey] = useState<string | null>(null);

    const isPlainObject = useCallback((value: unknown): value is Record<string, any> => {
        return Object.prototype.toString.call(value) === '[object Object]';
    }, []);

    const renderObjectFields = useCallback((
        objectValue: Record<string, any>,
        onObjectChange: (nextObject: Record<string, any>) => void,
        depth: number = 0
    ): React.ReactNode => {
        const entries = Object.entries(objectValue || {});

        return (
            <div className="space-y-2">
                {entries.map(([childKey, childValue], childIndex) => {
                    const childIsObject = isPlainObject(childValue);
                    const childIsArray = Array.isArray(childValue);

                    return (
                        <div key={`${depth}-${childKey}-${childIndex}`} className="space-y-2">
                            <div className="flex items-center gap-1.5 group">
                                <Input
                                    className="font-mono text-[10px] bg-background-secondary/30 h-7 px-2 rounded-md border-transparent focus:border-border/50 transition-all placeholder:text-foreground-subtle/40 flex-[0.8]"
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
                                <span className="text-foreground-muted/20 text-[10px]">:</span>

                                {!childIsObject && !childIsArray && (
                                    <Input
                                        className="font-mono text-[10px] bg-background-secondary/30 h-7 px-2 rounded-md border-transparent focus:border-border/50 transition-all placeholder:text-foreground-subtle/40 flex-1"
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
                                    <div className="font-mono text-[10px] text-foreground-muted/60 px-2 h-7 flex items-center rounded-md bg-background-secondary/30 border border-transparent flex-1">
                                        {childIsObject
                                            ? `Object (${Object.keys(childValue as Record<string, any>).length})`
                                            : `Array (${(childValue as unknown[]).length})`}
                                    </div>
                                )}

                                {canEdit && (
                                    <button
                                        onClick={() => {
                                            const nextObject = { ...objectValue };
                                            delete nextObject[childKey];
                                            onObjectChange(nextObject);
                                        }}
                                        className="p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive rounded text-foreground-muted/40"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </div>

                            {childIsObject && (
                                <details className="ml-3 pl-3 border-l border-border/40 space-y-2">
                                    <summary className="cursor-pointer text-[10px] text-foreground-muted/50 hover:text-foreground-muted select-none transition-colors">
                                        Ver atributos
                                    </summary>
                                    <div className="pt-1">
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
                        </div>
                    );
                })}
            </div>
        );
    }, [isPlainObject, canEdit]);

    if (!step) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <div className="w-16 h-16 rounded-3xl bg-background-secondary/50 flex items-center justify-center mb-6 shadow-sm">
                    <MousePointer2 className="h-8 w-8 text-foreground-muted/20" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-2">No Step Selected</h3>
                <p className="text-[13px] text-foreground-muted/60 max-w-[200px] leading-relaxed">
                    Select a step from the editor to view and modify its properties.
                </p>
            </div>
        );
    }

    return (
        <div className="p-0 flex flex-col min-h-full animate-in fade-in duration-500">
            {/* Header / Context */}
            <div className="px-6 py-5 border-b border-border/40 bg-white/40 dark:bg-black/20 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent-blue/10 flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4 text-accent-blue" />
                    </div>
                    <div>
                        <h2 className="text-[14px] font-bold text-foreground">Step Properties</h2>
                        <p className="text-[11px] text-foreground-muted/60 font-medium uppercase tracking-wider mt-0.5">
                            Step #{stepIndex + 1}
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-10">
                {/* AI Context Section */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-foreground/80">
                        <Sparkles className="h-3.5 w-3.5 text-accent-blue" />
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.08em]">{t('aiContext') || 'AI Context (Purpose)'}</h3>
                    </div>
                    <div className="relative rounded-xl border border-border/60 bg-white dark:bg-background shadow-sm hover:border-accent-blue/30 transition-all group overflow-hidden">
                        <textarea
                            value={step.purpose || ''}
                            onChange={(e) => onUpdateStep(stepIndex, 'purpose', e.target.value)}
                            readOnly={!canEdit}
                            placeholder="Describe what this step does for the AI..."
                            className="w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-4 text-[13px] text-foreground leading-relaxed rounded-xl placeholder:text-foreground-muted/30 min-h-[100px] resize-none"
                        />
                        <div className="absolute bottom-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Bot className="h-3 w-3 text-accent-blue/40" />
                        </div>
                    </div>
                </section>

                {/* Technical Configuration */}
                <section className="space-y-6">
                    <div className="flex items-center gap-2 text-foreground/80">
                        <Settings2 className="h-3.5 w-3.5 text-foreground-muted" />
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.08em]">Technical Configuration</h3>
                    </div>
                    
                    <div className="space-y-5 px-1">
                        {/* Target Element */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[12px] font-semibold text-foreground/70">Target Element</label>
                                <span className="text-[10px] font-mono text-foreground-muted/50 bg-background-secondary px-1.5 py-0.5 rounded">Selector</span>
                            </div>
                            <div className="relative group">
                                <Hash className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted/40 transition-colors group-focus-within:text-accent-blue" />
                                <Input
                                    className="font-mono text-[12px] bg-white dark:bg-background border-border/60 focus:border-accent-blue/50 focus:ring-accent-blue/5 h-10 pl-9 pr-3 rounded-xl transition-all shadow-sm"
                                    value={step.target || ''}
                                    onChange={e => onUpdateStep(stepIndex, 'target', e.target.value)}
                                    placeholder="e.g. #submit-button"
                                    readOnly={!canEdit}
                                />
                            </div>
                        </div>

                        {/* Placement */}
                        <div className="space-y-2">
                            <label className="text-[12px] font-semibold text-foreground/70">Tooltip Placement</label>
                            <Select
                                value={step.placement || 'auto'}
                                onValueChange={(value) => onUpdateStep(stepIndex, 'placement', value)}
                                disabled={!canEdit}
                            >
                                <SelectTrigger className="w-full h-10 px-4 rounded-xl bg-white dark:bg-background border-border/60 text-[13px] transition-all hover:border-accent-blue/30 focus:ring-accent-blue/5 focus:border-accent-blue/50 cursor-pointer shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <Layout className="h-3.5 w-3.5 text-foreground-muted/50" />
                                        <SelectValue placeholder="Select placement..." />
                                    </div>
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border/60 shadow-xl">
                                    <SelectItem value="auto" className="rounded-md">Automatic</SelectItem>
                                    <SelectGroup>
                                        <SelectItem value="top" className="rounded-md">Top</SelectItem>
                                        <SelectItem value="bottom" className="rounded-md">Bottom</SelectItem>
                                        <SelectItem value="left" className="rounded-md">Left</SelectItem>
                                        <SelectItem value="right" className="rounded-md">Right</SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </section>

                {/* Metadata Section */}
                <section className="space-y-4 pt-4 border-t border-border/40">
                    <div className="flex items-center justify-between px-0.5">
                        <div className="flex items-center gap-2 text-foreground/80">
                            <Component className="h-3.5 w-3.5 text-foreground-muted" />
                            <h3 className="text-[11px] font-bold uppercase tracking-[0.08em]">{t('metadata') || 'Metadata'}</h3>
                        </div>
                        {canEdit && (
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
                                className="h-7 px-2 text-[11px] font-semibold text-accent-blue hover:bg-accent-blue/5 rounded-lg gap-1.5"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Add Entry
                            </Button>
                        )}
                    </div>

                    <div className="bg-background-secondary/30 dark:bg-background/40 rounded-2xl p-5 border border-border/50 shadow-inner min-h-[100px]">
                        {Object.keys(step.metadata || {}).length > 0 ? (
                            <div className="space-y-4">
                                {renderObjectFields(step.metadata || {}, (nextMeta) => {
                                    onUpdateStep(stepIndex, 'metadata', nextMeta);
                                })}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center py-6">
                                <div className="w-10 h-10 rounded-full bg-border/20 flex items-center justify-center mb-3">
                                    <ListTree className="h-5 w-5 text-foreground-muted/30" />
                                </div>
                                <p className="text-[12px] text-foreground-muted/40 font-medium italic">
                                    No custom metadata defined for this step
                                </p>
                            </div>
                        )}
                    </div>
                </section>

                {/* Help Section */}
                <div className="p-5 rounded-2xl bg-accent-blue/5 border border-accent-blue/10 shadow-[0_4px_12px_rgba(var(--accent-blue-rgb),0.03)]">
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-accent-blue/20 flex items-center justify-center shrink-0">
                            <Info className="h-3.5 w-3.5 text-accent-blue" />
                        </div>
                        <p className="text-[12px] text-foreground-muted/80 leading-relaxed font-medium">
                            Need help? <span className="text-accent-blue cursor-pointer hover:underline">Learn more</span> about how these properties impact the walkthrough experience.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
});

import { MousePointer2, Sparkles, Settings2, ListTree } from 'lucide-react';
