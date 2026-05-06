'use client';

import React from 'react';
import { Step } from '@luma/infra';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Route, PanelLeftClose, PanelLeftOpen, Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import SortableStepItem from '@/components/walkthrough-editor/SortableStepItem';
import {
    DndContext,
    closestCenter,
    DragEndEvent,
    SensorDescriptor,
    SensorOptions,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface StepsSidebarProps {
    steps: Step[];
    selectedStepIndex: number;
    canEdit: boolean;
    sensors: SensorDescriptor<SensorOptions>[];
    isExpanded: boolean;
    onToggleExpand: () => void;
    onAddStep: () => void;
    onSelectStep: (index: number) => void;
    onDuplicateStep: (index: number) => void;
    onMoveStep: (index: number, direction: 'up' | 'down') => void;
    onRemoveStep: (index: number) => void;
    onDragEnd: (event: DragEndEvent) => void;
}

export const StepsSidebar = React.memo(function StepsSidebar({
    steps,
    selectedStepIndex,
    canEdit,
    sensors,
    isExpanded,
    onToggleExpand,
    onAddStep,
    onSelectStep,
    onDuplicateStep,
    onMoveStep,
    onRemoveStep,
    onDragEnd,
}: StepsSidebarProps) {
    const t = useTranslations('Editor');
    const [searchQuery, setSearchQuery] = React.useState('');

    const filteredSteps = React.useMemo(() => {
        if (!searchQuery) return steps;
        const lowerQuery = searchQuery.toLowerCase();
        return steps.filter(step =>
            (step.title?.toLowerCase().includes(lowerQuery)) ||
            (step.description?.toLowerCase().includes(lowerQuery)) ||
            (step.target?.toLowerCase().includes(lowerQuery))
        );
    }, [steps, searchQuery]);

    return (
        <aside className="w-full shrink-0 bg-background flex flex-col transition-all duration-200 h-full">
            <div className="flex flex-col border-b border-border bg-background-secondary/30">
                <div className="px-3 h-11 flex justify-between items-center shrink-0">
                    <h3 className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider flex items-center gap-1.5">
                        <Route className="h-3.5 w-3.5" />{t('steps')}
                    </h3>
                    {canEdit && (
                        <Button
                            onClick={onAddStep}
                            variant="ghost"
                            size="icon"
                            className="rounded-full hover:bg-background-tertiary text-primary h-7 w-7"
                        >
                            <Plus className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>
                {/* Search Input */}
                <div className="px-3 pb-2">
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-foreground-muted pointer-events-none" />
                        <Input
                            placeholder={t('searchSteps')}
                            className="h-7 pl-7 py-1 text-xs bg-background border-border/50 focus:bg-background focus:border-border"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-foreground-muted hover:text-foreground"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
                {steps.length === 0 && (
                    <div className="border border-dashed border-border rounded-lg p-4 text-center">
                        <p className="text-xs text-foreground-muted">
                            {t('noStepsYet')}
                        </p>
                    </div>
                )}

                {searchQuery && filteredSteps.length === 0 && steps.length > 0 && (
                    <div className="text-center py-4">
                        <p className="text-xs text-foreground-muted">{t('noResults')}</p>
                    </div>
                )}

                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onDragEnd}
                >
                    <SortableContext
                        items={filteredSteps.map(s => s.id)}
                        strategy={verticalListSortingStrategy}
                        disabled={!!searchQuery} // Disable DnD when searching
                    >
                        {filteredSteps.map((step) => {
                            // Find the original index for callbacks
                            const originalIndex = steps.findIndex(s => s.id === step.id);
                            return (
                                <SortableStepItem
                                    key={step.id}
                                    step={step}
                                    index={originalIndex}
                                    isActive={selectedStepIndex === originalIndex}
                                    totalSteps={steps.length}
                                    onClick={() => onSelectStep(originalIndex)}
                                    onDuplicate={() => onDuplicateStep(originalIndex)}
                                    onMoveUp={() => onMoveStep(originalIndex, 'up')}
                                    onMoveDown={() => onMoveStep(originalIndex, 'down')}
                                    onDelete={() => onRemoveStep(originalIndex)}
                                />
                            );
                        })}
                    </SortableContext>
                </DndContext>
            </div>

        </aside>
    );
});
