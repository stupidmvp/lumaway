'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

interface StandardPaginationProps {
    page: number;
    totalPages: number;
    onPageChange: (page: number | ((p: number) => number)) => void;
    totalResults: number;
    limit: number;
    resultsOnPage: number;
}

export function StandardPagination({
    page,
    totalPages,
    onPageChange,
    totalResults,
    limit,
    resultsOnPage
}: StandardPaginationProps) {
    const t = useTranslations('Pagination');
    const tc = useTranslations('Common');

    if (totalResults === 0) return null;

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border/40">
            <p className="text-sm text-foreground-muted">
                {t('showingResults', { count: resultsOnPage, total: totalResults })}
            </p>
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-1 text-sm text-foreground-muted">
                    {t('pageOf', { current: page + 1, total: totalPages || 1 })}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 0}
                        onClick={() => onPageChange(p => Math.max(0, p - 1))}
                        className="h-9 gap-1 shadow-sm px-3 hover:bg-background-secondary cursor-pointer"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        <span>{tc('previous')}</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages - 1}
                        onClick={() => onPageChange(p => p + 1)}
                        className="h-9 gap-1 shadow-sm px-3 hover:bg-background-secondary cursor-pointer"
                    >
                        <span>{tc('next')}</span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
