'use client';

import { ReactNode } from 'react';
import { SearchInput } from '@/components/ui/search-input';
import { FilterButton } from '@/components/shared/FilterButton';
import { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface FilterOption {
    label: string;
    value: string;
    icon?: LucideIcon;
}

interface StandardToolbarProps {
    search: string;
    onSearchChange: (value: string) => void;
    onSearchClear: () => void;
    filterValue: string;
    onFilterChange: (value: string) => void;
    filterOptions: FilterOption[];
    filterTitle?: string;
    placeholder?: string;
    /** Extra action buttons rendered after the filter */
    actions?: ReactNode;
}

export function StandardToolbar({
    search,
    onSearchChange,
    onSearchClear,
    filterValue,
    onFilterChange,
    filterOptions,
    filterTitle,
    placeholder,
    actions,
}: StandardToolbarProps) {
    const tc = useTranslations('Common');

    return (
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
            <div className="w-full sm:w-96">
                <SearchInput
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    onClear={onSearchClear}
                    placeholder={placeholder || tc('search')}
                    className="bg-background"
                />
            </div>

            <div className="flex items-center gap-2 ml-auto">
                <FilterButton
                    title={filterTitle || tc('status')}
                    value={filterValue}
                    onChange={onFilterChange}
                    options={filterOptions}
                />
                {actions}
            </div>
        </div>
    );
}
