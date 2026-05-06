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

    const renderArrayFields = useCallback((
        arrayValue: any[],
        onArrayChange: (nextArray: any[]) => void,
        depth: number = 0
    ): React.ReactNode => {
        return (
            <div className="space-y-3">
                {arrayValue.map((item, index) => {
                    const itemIsObject = isPlainObject(item);
                    const itemIsArray = Array.isArray(item);

                    return (
                        <div key={`${depth}-item-${index}`} className="space-y-2">
                            <div className="flex items-center gap-2 group">
                                <div className="text-[10px] font-bold text-foreground-muted/40 w-12 shrink-0">
                                    #{index}
                                </div>
                                {!itemIsObject && !itemIsArray ? (
                                    <Input
                                        className="font-mono text-[10px] bg-background-secondary/30 h-7 px-2 rounded-md border-transparent focus:border-border/50 transition-all flex-1"
                                        value={item == null ? '' : String(item)}
                                        onChange={(e) => {
                                            const nextArray = [...arrayValue];
                                            nextArray[index] = e.target.value;
                                            onArrayChange(nextArray);
                                        }}
                                    />
                                ) : (
                                    <div className="font-mono text-[10px] text-foreground-muted/60 px-2 h-7 flex items-center rounded-md bg-background-secondary/30 border border-transparent flex-1">
                                        {itemIsObject
                                            ? `Object (${Object.keys(item).length})`
                                            : `Array (${item.length})`}
                                    </div>
                                )}
                                {canEdit && (
                                    <button
                                        onClick={() => {
                                            const nextArray = arrayValue.filter((_, i) => i !== index);
                                            onArrayChange(nextArray);
                                        }}
                                        className="p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive rounded text-foreground-muted/40"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </div>

                            {itemIsObject && (
                                <details className="ml-3 pl-3 border-l border-border/40 space-y-2" open={depth < 1}>
                                    <summary className="cursor-pointer text-[10px] text-foreground-muted/50 hover:text-foreground-muted select-none transition-colors">
                                        Ver atributos
                                    </summary>
                                    <div className="pt-1">
                                        {renderObjectFields(
                                            item,
                                            (nextItem) => {
                                                const nextArray = [...arrayValue];
                                                nextArray[index] = nextItem;
                                                onArrayChange(nextArray);
                                            },
                                            depth + 1
                                        )}
                                    </div>
                                </details>
                            )}

                            {itemIsArray && (
                                <details className="ml-3 pl-3 border-l border-border/40 space-y-2">
                                    <summary className="cursor-pointer text-[10px] text-foreground-muted/50 hover:text-foreground-muted select-none transition-colors">
                                        Ver contenido
                                    </summary>
                                    <div className="pt-1">
                                        {renderArrayFields(
                                            item,
                                            (nextItem) => {
                                                const nextArray = [...arrayValue];
                                                nextArray[index] = nextItem;
                                                onArrayChange(nextArray);
                                            },
                                            depth + 1
                                        )}
                                    </div>
                                </details>
                            )}
                        </div>
                    );
                })}
                {canEdit && (
                    <Button
                        onClick={() => {
                            onArrayChange([...arrayValue, '']);
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-accent-blue hover:bg-accent-blue/5 rounded-md gap-1"
                    >
                        <Plus className="h-3 w-3" />
                        Add Item
                    </Button>
                )}
            </div>
        );
    }, [isPlainObject, canEdit]);

    const renderObjectFields = useCallback((
        objectValue: Record<string, any>,
        onObjectChange: (nextObject: Record<string, any>) => void,
        depth: number = 0
    ): React.ReactNode => {
        const entries = Object.entries(objectValue || {});

        return (
            <div className="space-y-4">
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
                                <details className="ml-3 pl-3 border-l border-border/40 space-y-2" open={depth < 1}>
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

                            {childIsArray && (
                                <details className="ml-3 pl-3 border-l border-border/40 space-y-2">
                                    <summary className="cursor-pointer text-[10px] text-foreground-muted/50 hover:text-foreground-muted select-none transition-colors">
                                        Ver elementos
                                    </summary>
                                    <div className="pt-1">
                                        {renderArrayFields(
                                            childValue as any[],
                                            (nextArray) => {
                                                const nextObject = { ...objectValue };
                                                nextObject[childKey] = nextArray;
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
    }, [isPlainObject, canEdit, renderArrayFields]);

    if (!step) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center h-full bg-background">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-6">
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
        <div className="p-0 flex flex-col min-h-full divide-y divide-border/40 bg-background">
            {/* AI Context Section */}
            <section className="p-6 space-y-6">
                <div className="flex items-center gap-2 text-foreground/80">
                    <Sparkles className="h-3.5 w-3.5 text-accent-blue" />
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.08em]">{t('aiContext') || 'AI Context'}</h3>
                </div>
                
                <div className="space-y-4 px-1">
                    <Textarea
                        value={step.aiContext || ''}
                        onChange={(e) => onUpdateStep(stepIndex, 'aiContext', e.target.value)}
                        readOnly={!canEdit}
                        placeholder="Add business logic or technical context for the AI..."
                        className="min-h-[120px] text-[13px] bg-muted/30 border-border resize-none focus:ring-1 focus:ring-accent-blue/20"
                    />
                </div>
            </section>

            {/* Technical Configuration Section */}
            <section className="p-6 space-y-6">
                <div className="flex items-center gap-2 text-foreground/80">
                    <Settings2 className="h-3.5 w-3.5 text-foreground-muted" />
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.08em]">Technical Config</h3>
                </div>
                
                <div className="space-y-5 px-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[12px] font-semibold text-foreground/70">Placement</label>
                            <Select
                                value={step.placement || 'auto'}
                                onValueChange={(value) => onUpdateStep(stepIndex, 'placement', value)}
                                disabled={!canEdit}
                            >
                                <SelectTrigger className="w-full h-9 px-3 rounded-md bg-muted/30 border-border text-[12px]">
                                    <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-lg border-border shadow-xl">
                                    <SelectItem value="auto">Automatic</SelectItem>
                                    <SelectItem value="top">Top</SelectItem>
                                    <SelectItem value="bottom">Bottom</SelectItem>
                                    <SelectItem value="left">Left</SelectItem>
                                    <SelectItem value="right">Right</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[12px] font-semibold text-foreground/70">Reference</label>
                            <Input
                                value={step.target || ''}
                                onChange={(e) => onUpdateStep(stepIndex, 'target', e.target.value)}
                                readOnly={!canEdit}
                                className="h-9 text-[12px] bg-muted/30 border-border font-mono"
                                placeholder="#id or .class"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Metadata Section */}
            <section className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-foreground/80">
                        <Component className="h-3.5 w-3.5 text-foreground-muted" />
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.08em]">Step Metadata</h3>
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
                            }}
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] text-accent-blue hover:bg-accent-blue/5 rounded-md gap-1"
                        >
                            <Plus className="h-3 w-3" />
                            Add Entry
                        </Button>
                    )}
                </div>

                <div className="p-4 rounded-lg bg-muted/30 border border-border min-h-[80px]">
                    {renderObjectFields(
                        step.metadata || {},
                        (nextMetadata) => onUpdateStep(stepIndex, 'metadata', nextMetadata)
                    )}
                </div>
            </section>

            {/* Help / Footer */}
            <div className="p-6">
                <div className="p-5 rounded-2xl bg-accent-blue/5 border border-accent-blue/10">
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-accent-blue/20 flex items-center justify-center shrink-0">
                            <Info className="h-3.5 w-3.5 text-accent-blue" />
                        </div>
                        <p className="text-[12px] text-foreground-muted/80 leading-relaxed font-medium">
                            These properties define the technical behavior of this step during playback.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
});

import { MousePointer2, Sparkles, Settings2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
