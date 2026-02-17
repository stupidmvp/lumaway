'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { MousePointerClick, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface EmptyStepStateProps {
    canEdit: boolean;
    onAddStep: () => void;
}

export const EmptyStepState = React.memo(function EmptyStepState({
    canEdit,
    onAddStep,
}: EmptyStepStateProps) {
    const t = useTranslations('Editor');

    return (
        <div className="flex flex-1 flex-col items-center justify-center text-foreground-subtle border-t border-dashed border-border/30 mt-4 pt-8 px-4">
            <div className="relative mb-4">
                <div className="absolute inset-0 bg-primary/10 blur-2xl rounded-full" />
                <MousePointerClick className="h-10 w-10 relative opacity-30 text-primary" />
            </div>
            <h2 className="text-base font-semibold text-foreground tracking-tight mb-1.5 text-center">{t('noStepSelected')}</h2>
            <p className="text-foreground-muted text-xs max-w-xs text-center mb-5">
                {t('noStepSelectedDescription')}
            </p>
            {canEdit && (
                <Button
                    onClick={onAddStep}
                    className="gap-2 px-5 shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
                >
                    <Plus className="h-4 w-4" />
                    {t('createFirstStep')}
                </Button>
            )}
        </div>
    );
});

