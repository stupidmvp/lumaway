'use client';

import React from 'react';
import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface WalkthroughTitleBlockProps {
    title: string;
    description: string | null;
    canEdit: boolean;
    onTitleChange: (title: string) => void;
    onDescriptionChange?: (description: string) => void;
}

export const WalkthroughTitleBlock = React.memo(function WalkthroughTitleBlock({
    title,
    description,
    canEdit,
    onTitleChange,
    onDescriptionChange,
}: WalkthroughTitleBlockProps) {
    const t = useTranslations('Editor');

    return (
        <div className="mb-1">
            {/* Editable title */}
            <div className="flex-1 min-w-0 group">
                <div className="flex items-center gap-2 w-full">
                    <input
                        value={title}
                        onChange={e => canEdit && onTitleChange(e.target.value)}
                        readOnly={!canEdit}
                        className={cn(
                            "flex-1 min-w-0 text-xl sm:text-2xl font-bold px-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-none shadow-none bg-transparent placeholder:text-foreground-muted/50 text-foreground transition-none",
                            canEdit ? "cursor-text" : "cursor-default"
                        )}
                        placeholder={t('walkthroughTitlePlaceholder')}
                    />
                    {canEdit && (
                        <Pencil className="h-3.5 w-3.5 shrink-0 text-foreground-muted/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
                    )}
                </div>
            </div>

            {/* Description */}
            <div className="mt-0.5">
                <textarea
                    value={description || ''}
                    onChange={e => canEdit && onDescriptionChange?.(e.target.value)}
                    readOnly={!canEdit}
                    rows={1}
                    maxLength={2000}
                    className={cn(
                        "w-full text-sm bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus:border-none shadow-none resize-none placeholder:text-foreground-muted/50 text-foreground-muted leading-relaxed px-0 transition-none",
                        canEdit ? "cursor-text" : "cursor-default"
                    )}
                    placeholder={t('descriptionPlaceholder')}
                />
            </div>
        </div>
    );
});
