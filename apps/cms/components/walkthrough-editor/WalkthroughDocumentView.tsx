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
        <div className="bg-background rounded-xl border border-border/60 shadow-sm overflow-hidden mb-6">
            <div className="px-5 py-3.5 border-b border-border/40 bg-background-secondary/20 flex items-center gap-2">
                <FileText className="h-4 w-4 text-foreground-muted" />
                <h3 className="text-sm font-medium text-foreground">
                    {t('documentView') || 'Document View'}
                </h3>
            </div>
            
            <div className="p-6 sm:p-8 max-w-3xl mx-auto">
                <div className="space-y-8">
                    {steps.map((step, index) => (
                        <div key={step.id} className="flex items-start gap-4 group">
                            {/* Step Number */}
                            <div className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-md flex items-center justify-center bg-background-secondary text-foreground-muted text-xs font-semibold border border-border/50 select-none">
                                {index + 1}
                            </div>
                            
                            {/* Step Content */}
                            <div className="flex-1 min-w-0">
                                <h4 className="text-[15px] font-semibold text-foreground leading-snug tracking-tight">
                                    {step.title || t('untitledStep')}
                                </h4>
                                
                                {step.description ? (
                                    <p className="mt-2 text-[14px] text-foreground-subtle leading-relaxed whitespace-pre-wrap">
                                        {step.description}
                                    </p>
                                ) : (
                                    <p className="mt-2 text-[13px] text-foreground-muted/50 italic leading-relaxed">
                                        {t('noDescription')}
                                    </p>
                                )}

                                {/* Subtle Technical Target */}
                                {step.target && (
                                    <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border/30 bg-background-secondary/30 text-[10px] text-foreground-muted opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                        <Target className="h-2.5 w-2.5" />
                                        <code className="font-mono truncate max-w-[300px]">{step.target}</code>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
