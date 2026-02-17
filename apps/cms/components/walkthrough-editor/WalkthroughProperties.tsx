'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Tag, X, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

/* ─── Props ─── */

interface WalkthroughPropertiesProps {
    tags: string[];
    canEdit: boolean;
    onTagsChange?: (tags: string[]) => void;
}

/* ─── Component ─── */

export const WalkthroughProperties = React.memo(function WalkthroughProperties({
    tags,
    canEdit,
    onTagsChange,
}: WalkthroughPropertiesProps) {
    const tw = useTranslations('Walkthroughs');

    const [tagInput, setTagInput] = useState('');
    const [isTagInputVisible, setIsTagInputVisible] = useState(false);
    const tagInputRef = useRef<HTMLInputElement>(null);

    const addTag = useCallback((value: string) => {
        const cleaned = value.trim().toLowerCase();
        if (!cleaned || cleaned.length > 50) return;
        if (tags.includes(cleaned)) return;
        if (tags.length >= 20) return;
        onTagsChange?.([...tags, cleaned]);
        setTagInput('');
    }, [tags, onTagsChange]);

    const removeTag = useCallback((tag: string) => {
        onTagsChange?.(tags.filter(t => t !== tag));
    }, [tags, onTagsChange]);

    const handleTagKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(tagInput);
        } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
            removeTag(tags[tags.length - 1]!);
        } else if (e.key === 'Escape') {
            setTagInput('');
            setIsTagInputVisible(false);
        }
    }, [tagInput, tags, addTag, removeTag]);

    const handleTagInputBlur = useCallback(() => {
        if (tagInput.trim()) {
            addTag(tagInput);
        }
        setIsTagInputVisible(false);
    }, [tagInput, addTag]);

    return (
        <div className="flex items-center min-h-[28px] py-0.5">
            <div className="w-[100px] shrink-0 flex items-center gap-2 text-foreground-muted">
                <Tag className="h-3.5 w-3.5" />
                <span className="text-xs">{tw('filterByTags')}</span>
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                {tags.map((tag) => (
                    <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-1.5 py-0 rounded text-[11px] font-medium bg-accent-blue/8 text-accent-blue border border-accent-blue/15"
                    >
                        {tag}
                        {canEdit && (
                            <button
                                type="button"
                                onClick={() => removeTag(tag)}
                                className="ml-0.5 rounded-full hover:bg-accent-blue/20 p-0.5 transition-colors"
                            >
                                <X className="h-2 w-2" />
                            </button>
                        )}
                    </span>
                ))}
                {canEdit && (
                    isTagInputVisible ? (
                        <input
                            ref={tagInputRef}
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={handleTagKeyDown}
                            onBlur={handleTagInputBlur}
                            autoFocus
                            placeholder={tw('tagPlaceholder')}
                            className="h-5 text-[11px] px-1.5 py-0 bg-transparent border border-border/50 rounded outline-none focus:border-accent-blue/40 text-foreground placeholder:text-foreground-subtle w-24"
                        />
                    ) : (
                        <button
                            type="button"
                            onClick={() => setIsTagInputVisible(true)}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[11px] font-medium text-foreground-muted hover:text-foreground-subtle hover:bg-background-secondary border border-dashed border-border/50 transition-colors"
                        >
                            <Plus className="h-2.5 w-2.5" />
                            {tw('addTag')}
                        </button>
                    )
                )}
                {tags.length === 0 && !canEdit && (
                    <span className="text-xs text-foreground-muted">—</span>
                )}
            </div>
        </div>
    );
});
