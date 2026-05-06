'use client';

import React from 'react';
import { Step } from '@luma/infra';
import { useTranslations } from 'next-intl';
import { Target, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WalkthroughDocumentViewProps {
    steps: Step[];
    canEdit: boolean;
    onUpdateStep: (index: number, field: keyof Step, value: any) => void;
    onAddStep: () => void;
}

export function WalkthroughDocumentView({ steps, canEdit, onUpdateStep, onAddStep }: WalkthroughDocumentViewProps) {
    const t = useTranslations('Editor');

    if (!steps || steps.length === 0) {
        return null;
    }

    return (
        <div className="py-8 px-2 max-w-[900px] mx-auto w-full">
            <div className="space-y-6 font-sans">
                {steps.map((step, index) => (
                    <div key={step.id} className="group relative flex flex-col gap-1 rounded-md px-2 py-1 hover:bg-background-secondary/40 transition-colors duration-200">
                        {/* Notion-style Block Drag Handle (Aesthetic only for preview) */}
                        <div className="absolute -left-6 top-2.5 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-[2px] cursor-default items-center justify-center text-foreground-muted/40 px-1 py-1">
                            <div className="flex gap-[2px]">
                                <div className="w-[3px] h-[3px] rounded-full bg-current"></div>
                                <div className="w-[3px] h-[3px] rounded-full bg-current"></div>
                            </div>
                            <div className="flex gap-[2px]">
                                <div className="w-[3px] h-[3px] rounded-full bg-current"></div>
                                <div className="w-[3px] h-[3px] rounded-full bg-current"></div>
                            </div>
                            <div className="flex gap-[2px]">
                                <div className="w-[3px] h-[3px] rounded-full bg-current"></div>
                                <div className="w-[3px] h-[3px] rounded-full bg-current"></div>
                            </div>
                        </div>

                        {/* Step Title (H3 style in Notion) */}
                        <div className="flex items-start gap-2">
                            <span className="mt-[2px] font-mono text-foreground-muted/60 select-none text-[13px]">
                                {index + 1}.
                            </span>
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
                        <div className="pl-[22px]">
                            <textarea
                                value={step.description || ''}
                                onChange={(e) => {
                                    if (canEdit) {
                                        onUpdateStep(index, 'description', e.target.value);
                                        // Simple auto-resize
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
                                    <Target className="h-3 w-3" />
                                    <code className="font-mono text-[10px] truncate max-w-[300px]">{step.target}</code>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

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
        </div>
    );
}
