'use client';

import React from 'react';
import { Step } from '@luma/infra';
import { useTranslations } from 'next-intl';
import { Target, FileText } from 'lucide-react';

interface WalkthroughDocumentViewProps {
    steps: Step[];
}

export function WalkthroughDocumentView({ steps }: WalkthroughDocumentViewProps) {
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
                            <h3 className="text-[16px] font-semibold text-foreground leading-snug outline-none">
                                {step.title || t('untitledStep')}
                            </h3>
                        </div>
                        
                        {/* Step Content */}
                        <div className="pl-[22px]">
                            {step.description ? (
                                <p className="text-[15px] text-foreground-subtle leading-[1.6] whitespace-pre-wrap outline-none">
                                    {step.description}
                                </p>
                            ) : (
                                <p className="text-[15px] text-foreground-muted/40 italic leading-[1.6] outline-none">
                                    {t('noDescription')}
                                </p>
                            )}

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
            </div>
        </div>
    );
}
