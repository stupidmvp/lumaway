'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Step } from '@luma/infra';
import { useTranslations } from 'next-intl';
import { 
    Bot, 
    Hash, 
    Layout, 
    Component, 
    Plus, 
    X, 
    Info, 
    MousePointer2, 
    Sparkles, 
    Settings2, 
    MessageSquare,
    Target,
    CheckCircle2,
    Zap,
    ChevronDown,
    ChevronRight,
    Search
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tabs,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface StepPropertiesSidebarProps {
    step: Step | null;
    stepIndex: number;
    projectId: string;
    canEdit: boolean;
    onUpdateStep: (index: number, field: keyof Step, value: any) => void;
}

export const StepPropertiesSidebar = React.memo(function StepPropertiesSidebar({
    step,
    stepIndex,
    projectId,
    canEdit,
    onUpdateStep,
}: StepPropertiesSidebarProps) {
    const t = useTranslations('Editor');
    const [showAdvanced, setShowAdvanced] = useState(false);

    const isPlainObject = useCallback((value: unknown): value is Record<string, any> => {
        return Object.prototype.toString.call(value) === '[object Object]';
    }, []);

    const updateMetadata = useCallback((path: string, value: any) => {
        if (!step) return;
        const nextMetadata = JSON.parse(JSON.stringify(step.metadata || {}));
        const keys = path.split('.');
        let current = nextMetadata;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        
        current[keys[keys.length - 1]] = value;
        onUpdateStep(stepIndex, 'metadata', nextMetadata);
    }, [step, stepIndex, onUpdateStep]);

    const renderArrayFields = useCallback((
        arrayValue: any[],
        onArrayChange: (nextArray: any[]) => void,
        depth: number = 0
    ): React.ReactNode => {
        return (
            <div className="space-y-3">
                {arrayValue.map((item, index) => {
                    const itemIsObject = isPlainObject(item);
                    const itemIsArray = Array.isArray(item);

                    return (
                        <div key={`${depth}-item-${index}`} className="space-y-2">
                            <div className="flex items-center gap-2 group">
                                <div className="text-[10px] font-bold text-foreground-muted/40 w-8 shrink-0">
                                    #{index}
                                </div>
                                {!itemIsObject && !itemIsArray ? (
                                    <Input
                                        className="font-mono text-[10px] bg-background-secondary/30 h-7 px-2 rounded-md border-transparent focus:border-border/50 transition-all flex-1"
                                        value={item == null ? '' : String(item)}
                                        onChange={(e) => {
                                            const nextArray = [...arrayValue];
                                            nextArray[index] = e.target.value;
                                            onArrayChange(nextArray);
                                        }}
                                    />
                                ) : (
                                    <div className="font-mono text-[10px] text-foreground-muted/60 px-2 h-7 flex items-center rounded-md bg-background-secondary/30 border border-transparent flex-1">
                                        {itemIsObject
                                            ? `Object (${Object.keys(item).length})`
                                            : `Array (${item.length})`}
                                    </div>
                                )}
                                {canEdit && (
                                    <button
                                        onClick={() => {
                                            const nextArray = arrayValue.filter((_, i) => i !== index);
                                            onArrayChange(nextArray);
                                        }}
                                        className="p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive rounded text-foreground-muted/40"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </div>

                            {itemIsObject && (
                                <div className="ml-3 pl-3 border-l border-border/40 space-y-2">
                                    {renderObjectFields(
                                        item,
                                        (nextItem) => {
                                            const nextArray = [...arrayValue];
                                            nextArray[index] = nextItem;
                                            onArrayChange(nextArray);
                                        },
                                        depth + 1
                                    )}
                                </div>
                            )}

                            {itemIsArray && (
                                <div className="ml-3 pl-3 border-l border-border/40 space-y-2">
                                    {renderArrayFields(
                                        item,
                                        (nextItem) => {
                                            const nextArray = [...arrayValue];
                                            nextArray[index] = nextItem;
                                            onArrayChange(nextArray);
                                        },
                                        depth + 1
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
                {canEdit && (
                    <Button
                        onClick={() => {
                            onArrayChange([...arrayValue, '']);
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-accent-blue hover:bg-accent-blue/5 rounded-md gap-1"
                    >
                        <Plus className="h-3 w-3" />
                        Add Item
                    </Button>
                )}
            </div>
        );
    }, [isPlainObject, canEdit]);

    const renderObjectFields = useCallback((
        objectValue: Record<string, any>,
        onObjectChange: (nextObject: Record<string, any>) => void,
        depth: number = 0
    ): React.ReactNode => {
        const entries = Object.entries(objectValue || {});

        return (
            <div className="space-y-4">
                {entries.map(([childKey, childValue], childIndex) => {
                    const childIsObject = isPlainObject(childValue);
                    const childIsArray = Array.isArray(childValue);

                    // Skip the "human-friendly" fields already promoted to the main UI
                    const skipKeys = ['spokenExtract', 'guidance', 'runtime', 'timing', 'source', 'confidence', 'route', 'url'];
                    if (depth === 0 && skipKeys.includes(childKey)) return null;

                    return (
                        <div key={`${depth}-${childKey}-${childIndex}`} className="space-y-2">
                            <div className="flex items-center gap-1.5 group">
                                <Input
                                    className="font-mono text-[10px] bg-background-secondary/30 h-7 px-2 rounded-md border-transparent focus:border-border/50 transition-all placeholder:text-foreground-subtle/40 flex-[0.8]"
                                    value={childKey}
                                    onChange={(e) => {
                                        const nextObject = { ...objectValue };
                                        const newKey = e.target.value;
                                        if (newKey !== childKey) {
                                            delete nextObject[childKey];
                                            nextObject[newKey] = childValue;
                                            onObjectChange(nextObject);
                                        }
                                    }}
                                    placeholder="Key"
                                />
                                <span className="text-foreground-muted/20 text-[10px]">:</span>

                                {!childIsObject && !childIsArray && (
                                    <Input
                                        className="font-mono text-[10px] bg-background-secondary/30 h-7 px-2 rounded-md border-transparent focus:border-border/50 transition-all placeholder:text-foreground-subtle/40 flex-1"
                                        value={childValue == null ? '' : String(childValue)}
                                        onChange={(e) => {
                                            const nextObject = { ...objectValue };
                                            nextObject[childKey] = e.target.value;
                                            onObjectChange(nextObject);
                                        }}
                                        placeholder="Value"
                                    />
                                )}

                                {(childIsObject || childIsArray) && (
                                    <div className="font-mono text-[10px] text-foreground-muted/60 px-2 h-7 flex items-center rounded-md bg-background-secondary/30 border border-transparent flex-1">
                                        {childIsObject
                                            ? `Object (${Object.keys(childValue as Record<string, any>).length})`
                                            : `Array (${(childValue as unknown[]).length})`}
                                    </div>
                                )}

                                {canEdit && (
                                    <button
                                        onClick={() => {
                                            const nextObject = { ...objectValue };
                                            delete nextObject[childKey];
                                            onObjectChange(nextObject);
                                        }}
                                        className="p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive rounded text-foreground-muted/40"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </div>

                            {childIsObject && (
                                <div className="ml-3 pl-3 border-l border-border/40 space-y-2">
                                    {renderObjectFields(
                                        childValue as Record<string, any>,
                                        (nextChildObject) => {
                                            const nextObject = { ...objectValue };
                                            nextObject[childKey] = nextChildObject;
                                            onObjectChange(nextObject);
                                        },
                                        depth + 1
                                    )}
                                </div>
                            )}

                            {childIsArray && (
                                <div className="ml-3 pl-3 border-l border-border/40 space-y-2">
                                    {renderArrayFields(
                                        childValue as any[],
                                        (nextArray) => {
                                            const nextObject = { ...objectValue };
                                            nextObject[childKey] = nextArray;
                                            onObjectChange(nextObject);
                                        },
                                        depth + 1
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }, [isPlainObject, canEdit, renderArrayFields]);

    const metadata = useMemo(() => step?.metadata || {}, [step]);
    const guidance = useMemo(() => metadata.guidance || {}, [metadata]);
    const runtime = useMemo(() => metadata.runtime || {}, [metadata]);
    const spokenIntent = metadata.spokenExtract || metadata.interactionMap?.transcriptText || '';

    if (!step) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center h-full bg-background">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-6">
                    <MousePointer2 className="h-8 w-8 text-foreground-muted/20" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-2">{t('noStepSelected')}</h3>
                <p className="text-[13px] text-foreground-muted/60 max-w-[200px] leading-relaxed">
                    {t('noStepSelectedDescription')}
                </p>
            </div>
        );
    }

    return (
        <div className="p-0 flex flex-col min-h-full divide-y divide-border/40 bg-background custom-scrollbar overflow-y-auto">
            {/* 1. Intent & Context Section */}
            <section className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-foreground/80">
                        <Sparkles className="h-3.5 w-3.5 text-accent-blue" />
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.08em]">{t('intentSection')}</h3>
                    </div>
                    {metadata.confidence && (
                        <div className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                            metadata.confidence > 0.8 ? "bg-accent-green/10 text-accent-green" : "bg-accent-orange/10 text-accent-orange"
                        )}>
                            {Math.round(metadata.confidence * 100)}% Match
                        </div>
                    )}
                </div>
                
                <div className="space-y-4 px-1">
                    <div className="space-y-2">
                        <Label className="text-[11px] font-semibold text-foreground-muted flex items-center gap-1.5">
                            <MessageSquare className="h-3 w-3" />
                            {t('spokenIntent')}
                        </Label>
                        <Textarea
                            value={spokenIntent}
                            onChange={(e) => updateMetadata('spokenExtract', e.target.value)}
                            readOnly={!canEdit}
                            placeholder={t('spokenIntentPlaceholder')}
                            className="min-h-[80px] text-[13px] bg-muted/20 border-border/50 resize-none focus:ring-1 focus:ring-accent-blue/20 placeholder:text-foreground-muted/20"
                        />
                    </div>
                </div>
            </section>

            {/* 2. Interactive Delivery Section */}
            <section className="p-6 space-y-6">
                <div className="flex items-center gap-2 text-foreground/80">
                    <Zap className="h-3.5 w-3.5 text-accent-pink" />
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.08em]">{t('deliverySection')}</h3>
                </div>
                <div className="space-y-5 px-1">
                    {/* Delivery Mode Selection */}
                    <div className="space-y-3">
                        <Label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider">{t('deliveryMode')}</Label>
                        <Tabs 
                            value={runtime.deliveryMode === 'chat-guided' ? 'chat' : 'interactive'} 
                            onValueChange={(val) => canEdit && updateMetadata('runtime.deliveryMode', val === 'chat' ? 'chat-guided' : 'interactive')}
                            className="w-full"
                        >
                            <TabsList className="grid w-full grid-cols-2 bg-muted/30 border border-border/40 h-10 p-1 rounded-xl">
                                <TabsTrigger 
                                    value="interactive" 
                                    className="rounded-lg text-[11px] font-semibold gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                                >
                                    <Target className="h-3.5 w-3.5" />
                                    {t('modeInteractive')}
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="chat" 
                                    className="rounded-lg text-[11px] font-semibold gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                                >
                                    <Bot className="h-3.5 w-3.5" />
                                    {t('modeChat')}
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-[11px] font-semibold text-foreground-muted">{t('placement')}</Label>
                            <Select
                                value={step.placement || 'auto'}
                                onValueChange={(value) => onUpdateStep(stepIndex, 'placement', value)}
                                disabled={!canEdit}
                            >
                                <SelectTrigger className="w-full h-8 px-2.5 rounded-md bg-muted/20 border-border/50 text-[11px]">
                                    <SelectValue placeholder={t('selectPlacement')} />
                                </SelectTrigger>
                                <SelectContent className="rounded-lg border-border shadow-xl">
                                    <SelectItem value="auto">{t('automatic')}</SelectItem>
                                    <SelectItem value="top">{t('top')}</SelectItem>
                                    <SelectItem value="bottom">{t('bottom')}</SelectItem>
                                    <SelectItem value="left">{t('left')}</SelectItem>
                                    <SelectItem value="right">{t('right')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[11px] font-semibold text-foreground-muted">{t('targetElement')}</Label>
                            <div className="relative group/target">
                                <Input
                                    value={step.target || ''}
                                    onChange={(e) => onUpdateStep(stepIndex, 'target', e.target.value)}
                                    readOnly={!canEdit}
                                    className="h-8 text-[11px] bg-muted/20 border-border/50 font-mono pr-8"
                                    placeholder="#id o .clase"
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted/40">
                                    <Hash className="h-3 w-3" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {runtime.fallbackReason && (
                        <div className="p-3 rounded-lg bg-accent-orange/5 border border-accent-orange/10 flex items-start gap-2">
                            <Info className="h-3.5 w-3.5 text-accent-orange shrink-0 mt-0.5" />
                            <p className="text-[10.5px] text-accent-orange/80 leading-relaxed">
                                {runtime.fallbackReason === 'missing-selector' 
                                    ? "Luma no pudo detectar un selector confiable. Se usará guía por chat."
                                    : "El selector detectado es débil. Se recomienda revisarlo manualmente."}
                            </p>
                        </div>
                    )}
                </div>
            </section>

            {/* 3. Guidance Details Section */}
            <section className="p-6 space-y-6">
                <div className="flex items-center gap-2 text-foreground/80">
                    <Bot className="h-3.5 w-3.5 text-accent-purple" />
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.08em]">{t('guidanceSection')}</h3>
                </div>
                
                <div className="space-y-5 px-1">
                    <div className="space-y-2">
                        <Label className="text-[11px] font-semibold text-foreground-muted">{t('specificAction')}</Label>
                        <Input
                            value={guidance.specificAction || ''}
                            onChange={(e) => updateMetadata('guidance.specificAction', e.target.value)}
                            readOnly={!canEdit}
                            placeholder={t('specificActionPlaceholder')}
                            className="h-9 text-[13px] bg-muted/20 border-border/50"
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <Label className="text-[11px] font-semibold text-foreground-muted">{t('expectedResult')}</Label>
                        <Input
                            value={guidance.expectedResult || ''}
                            onChange={(e) => updateMetadata('guidance.expectedResult', e.target.value)}
                            readOnly={!canEdit}
                            placeholder={t('expectedResultPlaceholder')}
                            className="h-9 text-[13px] bg-muted/20 border-border/50"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[11px] font-semibold text-foreground-muted flex items-center gap-1.5">
                            <CheckCircle2 className="h-3 w-3 text-accent-green" />
                            {t('verification')}
                        </Label>
                        <Input
                            value={guidance.verification || ''}
                            onChange={(e) => updateMetadata('guidance.verification', e.target.value)}
                            readOnly={!canEdit}
                            placeholder={t('verificationPlaceholder')}
                            className="h-9 text-[13px] bg-muted/20 border-border/50"
                        />
                    </div>
                </div>
            </section>

            {/* 4. Advanced Technical Data Section */}
            <section className="p-0">
                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full px-6 py-4 flex items-center justify-between text-foreground-muted hover:text-foreground hover:bg-muted/30 transition-all group"
                >
                    <div className="flex items-center gap-2">
                        <Settings2 className="h-3.5 w-3.5" />
                        <span className="text-[11px] font-bold uppercase tracking-[0.08em]">{t('advancedData')}</span>
                    </div>
                    {showAdvanced ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>

                {showAdvanced && (
                    <div className="px-6 pb-6 pt-2 space-y-6 bg-muted/5 border-t border-border/40">
                        <p className="text-[11px] text-foreground-muted/60 leading-relaxed italic">
                            {t('advancedDataDescription')}
                        </p>
                        
                        <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                            {renderObjectFields(
                                step.metadata || {},
                                (nextMetadata) => onUpdateStep(stepIndex, 'metadata', nextMetadata)
                            )}
                        </div>

                        {canEdit && (
                            <Button
                                onClick={() => {
                                    const currentMeta = step.metadata || {};
                                    const newKey = `custom_prop_${Object.keys(currentMeta).length + 1}`;
                                    onUpdateStep(stepIndex, 'metadata', {
                                        ...currentMeta,
                                        [newKey]: ''
                                    });
                                }}
                                variant="outline"
                                size="sm"
                                className="w-full h-8 text-[10px] gap-1.5 border-dashed border-border/60 hover:border-accent-blue/40"
                            >
                                <Plus className="h-3 w-3" />
                                Agregar Atributo Personalizado
                            </Button>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
});
