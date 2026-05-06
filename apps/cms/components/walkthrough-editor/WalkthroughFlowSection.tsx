'use client';

import React from 'react';
import { GitPullRequest, ArrowLeft, ArrowRight } from 'lucide-react';
import { Autocomplete } from '@/components/ui/autocomplete';
import { useTranslations } from 'next-intl';

interface WalkthroughFlowSectionProps {
    walkthroughId: string;
    projectId: string;
    parentId: string | null | undefined;
    previousWalkthroughId: string | null | undefined;
    nextWalkthroughId: string | null | undefined;
    onParentChange: (value: string | null) => void;
    onPreviousChange: (value: string | null) => void;
    onNextChange: (value: string | null) => void;
}

export const WalkthroughFlowSection = React.memo(function WalkthroughFlowSection({
    walkthroughId,
    projectId,
    parentId,
    previousWalkthroughId,
    nextWalkthroughId,
    onParentChange,
    onPreviousChange,
    onNextChange,
}: WalkthroughFlowSectionProps) {
    const t = useTranslations('Editor');

    return (
        <div className="space-y-4">
            {/* Parent walkthrough */}
            <div className="flex items-center min-h-[32px]">
                <div className="w-28 shrink-0 flex items-center gap-2 text-foreground-muted">
                    <GitPullRequest className="h-3.5 w-3.5" />
                    <span className="text-xs">{t('parent')}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <Autocomplete
                        value={parentId || ''}
                        onValueChange={(value) => onParentChange(value ? String(value) : null)}
                        service="walkthrough-parent-candidates"
                        optionLabel="title"
                        optionValue="id"
                        placeholder={t('selectParentWalkthrough')}
                        filterDefaultValues={{ projectId, walkthroughId }}
                        triggerClassName="h-8 text-xs border-border/40 bg-transparent hover:bg-background-secondary/50 rounded-md transition-colors"
                    />
                </div>
            </div>

            {/* Previous walkthrough */}
            <div className="flex items-center min-h-[32px]">
                <div className="w-28 shrink-0 flex items-center gap-2 text-foreground-muted">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span className="text-xs">{t('previous')}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <Autocomplete
                        value={previousWalkthroughId || ''}
                        onValueChange={(value) => onPreviousChange(value ? String(value) : null)}
                        service="walkthroughs"
                        optionLabel="title"
                        optionValue="id"
                        placeholder={t('selectWalkthrough')}
                        filterDefaultValues={{ projectId, 'id[$ne]': walkthroughId }}
                        triggerClassName="h-8 text-xs border-border/40 bg-transparent hover:bg-background-secondary/50 rounded-md transition-colors"
                    />
                </div>
            </div>

            {/* Next walkthrough */}
            <div className="flex items-center min-h-[32px]">
                <div className="w-28 shrink-0 flex items-center gap-2 text-foreground-muted">
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span className="text-xs">{t('next')}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <Autocomplete
                        value={nextWalkthroughId || ''}
                        onValueChange={(value) => onNextChange(value ? String(value) : null)}
                        service="walkthroughs"
                        optionLabel="title"
                        optionValue="id"
                        placeholder={t('selectWalkthrough')}
                        filterDefaultValues={{ projectId, 'id[$ne]': walkthroughId }}
                        triggerClassName="h-8 text-xs border-border/40 bg-transparent hover:bg-background-secondary/50 rounded-md transition-colors"
                    />
                </div>
            </div>
        </div>
    );
});
