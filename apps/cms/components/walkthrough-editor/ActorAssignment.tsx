'use client';

import React, { useCallback, useMemo } from 'react';
import {
    useActors,
    useWalkthroughActors,
    useAssignActor,
    useUnassignActor,
    type Actor,
} from '@luma/infra';
import { Badge } from '@/components/ui/badge';
import { getActorColor } from '@/components/project-detail/ActorsPanel';
import { UserCog, X, Plus, Check, Globe, Code } from 'lucide-react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ActorAssignmentProps {
    walkthroughId: string;
    projectId: string;
    canEdit: boolean;
}

export const ActorAssignment = React.memo(function ActorAssignment({
    walkthroughId,
    projectId,
    canEdit,
}: ActorAssignmentProps) {
    const t = useTranslations('Actors');

    const { data: projectActors } = useActors(projectId);
    const { data: assignedActors } = useWalkthroughActors(walkthroughId);
    const assignActor = useAssignActor();
    const unassignActor = useUnassignActor();

    const assignedActorIds = useMemo(
        () => new Set((assignedActors || []).map(a => a.actorId)),
        [assignedActors]
    );

    const handleToggle = useCallback(async (actor: Actor) => {
        const isAssigned = assignedActorIds.has(actor.id);
        try {
            if (isAssigned) {
                await unassignActor.mutateAsync({ walkthroughId, actorId: actor.id });
            } else {
                await assignActor.mutateAsync({ walkthroughId, actorId: actor.id });
            }
        } catch {
            toast.error(isAssigned ? 'Failed to unassign actor' : 'Failed to assign actor');
        }
    }, [walkthroughId, assignedActorIds, assignActor, unassignActor]);

    // Don't render if no actors are defined for this project
    if (!projectActors || projectActors.length === 0) return null;

    const assignedList = (projectActors || []).filter(a => assignedActorIds.has(a.id));
    const hasAssignedActors = assignedList.length > 0;

    return (
        <div className="flex items-center min-h-[28px] py-0.5">
            <div className="w-[100px] shrink-0 flex items-center gap-2 text-foreground-muted">
                <UserCog className="h-3.5 w-3.5" />
                <span className="text-xs">{t('title')}</span>
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">

            {hasAssignedActors ? (
                assignedList.map((actor) => {
                    const colorDef = getActorColor(actor.color);
                    return (
                        <Popover key={actor.id}>
                            <PopoverTrigger asChild>
                                <button type="button" className="cursor-pointer outline-none">
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            'gap-1 px-2 py-0.5 h-5 text-[10px] font-medium border-0 hover:ring-1 hover:ring-foreground/10 transition-all',
                                            colorDef.bg,
                                            colorDef.text,
                                        )}
                                    >
                                        <span className={cn('h-1.5 w-1.5 rounded-full', colorDef.dot)} />
                                        {actor.name}
                                    </Badge>
                                </button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-60 p-0" sideOffset={6}>
                                {/* Actor detail card */}
                                <div className="p-3 space-y-2.5">
                                    <div className="flex items-center gap-2.5">
                                        <div className={cn('h-7 w-7 rounded-full flex items-center justify-center shrink-0', colorDef.bg)}>
                                            <span className={cn('h-2.5 w-2.5 rounded-full', colorDef.dot)} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-foreground truncate">{actor.name}</p>
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <Code className="h-2.5 w-2.5 text-foreground-muted" />
                                                <span className="text-[10px] font-mono text-foreground-muted">{actor.slug}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {actor.description && (
                                        <p className="text-xs text-foreground-muted leading-relaxed">
                                            {actor.description}
                                        </p>
                                    )}
                                    {canEdit && (
                                        <div className="pt-1 border-t border-border/50">
                                            <button
                                                type="button"
                                                onClick={() => handleToggle(actor)}
                                                className="flex items-center gap-1.5 text-[11px] text-red-500 hover:text-red-600 transition-colors cursor-pointer"
                                            >
                                                <X className="h-3 w-3" />
                                                {t('unassign')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>
                    );
                })
            ) : (
                <Badge variant="outline" className="gap-1 px-2 py-0.5 h-5 text-[10px] font-medium text-foreground-muted border-border/50">
                    <Globe className="h-2.5 w-2.5" />
                    {t('allUsers')}
                </Badge>
            )}

            {canEdit && (
                <Popover>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium text-foreground-muted hover:text-foreground hover:bg-background-secondary border border-dashed border-border/50 transition-colors cursor-pointer h-5"
                        >
                            <Plus className="h-2.5 w-2.5" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="start"
                        className="w-56 p-1.5"
                    >
                        <div className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider px-2 py-1.5 mb-0.5">
                            {t('assignActors')}
                        </div>
                        <div className="space-y-0.5">
                            {(projectActors || []).map((actor) => {
                                const isAssigned = assignedActorIds.has(actor.id);
                                const colorDef = getActorColor(actor.color);
                                return (
                                    <button
                                        key={actor.id}
                                        type="button"
                                        onClick={() => handleToggle(actor)}
                                        className={cn(
                                            'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors cursor-pointer',
                                            isAssigned
                                                ? 'bg-accent-blue/10 text-accent-blue'
                                                : 'text-foreground hover:bg-background-secondary'
                                        )}
                                    >
                                        <span className={cn('h-2 w-2 rounded-full shrink-0', colorDef.dot)} />
                                        <span className="text-xs font-medium truncate flex-1 text-left">{actor.name}</span>
                                        {isAssigned && <Check className="h-3.5 w-3.5 shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>
                        {(!projectActors || projectActors.length === 0) && (
                            <p className="text-xs text-foreground-muted text-center py-3">
                                {t('noActorsFound')}
                            </p>
                        )}
                    </PopoverContent>
                </Popover>
            )}
            </div>
        </div>
    );
});
