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
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-background-secondary flex items-center justify-center mb-4">
                    <MousePointer2 className="h-6 w-6 text-foreground-muted/20" />
                </div>
                <p className="text-[13px] font-medium text-foreground-muted/60">
                    Select a step to see its properties
                </p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* AI Context (Purpose) */}
            <div className="space-y-4">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground-muted/50 px-0.5 flex items-center gap-2">
                    <Bot className="h-3 w-3" />
                    AI Context (Purpose)
                </h3>
                <div className="relative group">
                    <textarea
                        value={step.purpose || ''}
                        onChange={(e) => onUpdateStep(stepIndex, 'purpose', e.target.value)}
                        readOnly={!canEdit}
                        placeholder="Describe what this step does for the AI..."
                        className="w-full bg-background-secondary/40 border-none outline-none focus:outline-none focus:ring-0 p-3 text-[13px] text-foreground leading-relaxed rounded-xl placeholder:text-foreground-muted/20 min-h-[80px] resize-none transition-all group-hover:bg-background-secondary/60"
                    />
                </div>
            </div>

            {/* Target Element */}
            <div className="space-y-4">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground-muted/50 px-0.5 flex items-center gap-2">
                    <Hash className="h-3 w-3" />
                    Target Element
                </h3>
                <Input
                    className="font-mono text-[12px] bg-background-secondary/40 border-transparent focus:bg-background focus:border-border/50 h-10 px-3 rounded-xl transition-all placeholder:text-foreground-muted/20"
                    value={step.target || ''}
                    onChange={e => onUpdateStep(stepIndex, 'target', e.target.value)}
                    placeholder="e.g. #submit-button"
                    readOnly={!canEdit}
                />
            </div>

            {/* Placement */}
            <div className="space-y-4">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground-muted/50 px-0.5 flex items-center gap-2">
                    <Layout className="h-3 w-3" />
                    Placement
                </h3>
                <Select
                    value={step.placement || 'auto'}
                    onValueChange={(value) => onUpdateStep(stepIndex, 'placement', value)}
                    disabled={!canEdit}
                >
                    <SelectTrigger className="w-full h-10 px-3 rounded-xl bg-background-secondary/40 border-transparent text-[13px] transition-all hover:bg-background-secondary/60 focus:ring-2 focus:ring-accent-blue/10 focus:border-accent-blue/30 cursor-pointer">
                        <SelectValue placeholder="Select placement..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="auto">Automatic</SelectItem>
                        <SelectGroup>
                            <SelectItem value="top">Top</SelectItem>
                            <SelectItem value="bottom">Bottom</SelectItem>
                            <SelectItem value="left">Left</SelectItem>
                            <SelectItem value="right">Right</SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>

            {/* Metadata Tree */}
            <div className="space-y-4 pt-6 border-t border-border/40">
                <div className="flex items-center justify-between px-0.5">
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground-muted/50 flex items-center gap-2">
                        <Component className="h-3 w-3" />
                        Metadata
                    </h3>
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
                            className="h-6 w-6 p-0 hover:bg-background-secondary/50 rounded-lg"
                        >
                            <Plus className="h-3.5 w-3.5 text-foreground-muted/60" />
                        </Button>
                    )}
                </div>

                <div className="bg-background-secondary/20 rounded-xl p-4 border border-border/20">
                    {Object.keys(step.metadata || {}).length > 0 ? (
                        renderObjectFields(step.metadata || {}, (nextMeta) => {
                            onUpdateStep(stepIndex, 'metadata', nextMeta);
                        })
                    ) : (
                        <div className="text-[12px] text-foreground-muted/30 italic py-2 text-center">
                            No custom metadata
                        </div>
                    )}
                </div>
            </div>

            {/* Info Box */}
            <div className="p-4 rounded-2xl bg-accent-blue/5 border border-accent-blue/10">
                <div className="flex items-start gap-3">
                    <Info className="h-4 w-4 text-accent-blue mt-0.5 shrink-0" />
                    <p className="text-[12px] text-foreground-muted/70 leading-relaxed">
                        Step properties control how the individual step is targeted and displayed to the user during the walkthrough.
                    </p>
                </div>
            </div>
        </div>
    );
});

import { MousePointer2 } from 'lucide-react';
