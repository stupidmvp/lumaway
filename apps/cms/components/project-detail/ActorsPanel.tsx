'use client';

import { useState, useCallback, useEffect } from 'react';
import {
    useActors,
    useCreateActor,
    useUpdateActor,
    useDeleteActor,
    type Actor,
} from '@luma/infra';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    UserCog,
    Plus,
    Pencil,
    Trash2,
    Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// ── Color palette for actor badges ──────────────────────────────────────
const ACTOR_COLORS = [
    { name: 'blue', bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
    { name: 'green', bg: 'bg-green-500/10', text: 'text-green-600 dark:text-green-400', dot: 'bg-green-500' },
    { name: 'purple', bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500' },
    { name: 'orange', bg: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
    { name: 'red', bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
    { name: 'pink', bg: 'bg-pink-500/10', text: 'text-pink-600 dark:text-pink-400', dot: 'bg-pink-500' },
    { name: 'teal', bg: 'bg-teal-500/10', text: 'text-teal-600 dark:text-teal-400', dot: 'bg-teal-500' },
    { name: 'yellow', bg: 'bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400', dot: 'bg-yellow-500' },
];

export function getActorColor(colorName?: string) {
    return ACTOR_COLORS.find(c => c.name === colorName) ?? ACTOR_COLORS[0]!;
}

function generateSlugFromName(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

// ── Actor Form Dialog ───────────────────────────────────────────────────

interface ActorFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    actor?: Actor; // If provided, we're editing
}

function ActorFormDialog({ open, onOpenChange, projectId, actor }: ActorFormDialogProps) {
    const t = useTranslations('Actors');
    const isEditing = !!actor;

    const [name, setName] = useState(actor?.name || '');
    const [slug, setSlug] = useState(actor?.slug || '');
    const [description, setDescription] = useState(actor?.description || '');
    const [color, setColor] = useState(actor?.color || 'blue');
    const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

    const createActor = useCreateActor();
    const updateActor = useUpdateActor();

    const isPending = createActor.isPending || updateActor.isPending;

    // Sync form state when actor prop changes (edit mode) or dialog opens
    useEffect(() => {
        if (open && actor) {
            setName(actor.name);
            setSlug(actor.slug);
            setDescription(actor.description || '');
            setColor(actor.color || 'blue');
            setSlugManuallyEdited(false);
        } else if (open && !actor) {
            setName('');
            setSlug('');
            setDescription('');
            setColor('blue');
            setSlugManuallyEdited(false);
        }
    }, [open, actor]);

    const handleNameChange = useCallback((value: string) => {
        setName(value);
        if (!slugManuallyEdited && !isEditing) {
            setSlug(generateSlugFromName(value));
        }
    }, [slugManuallyEdited, isEditing]);

    const handleSlugChange = useCallback((value: string) => {
        setSlugManuallyEdited(true);
        setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
    }, []);

    const handleSubmit = useCallback(async () => {
        if (!name.trim() || !slug.trim()) return;

        try {
            if (isEditing && actor) {
                await updateActor.mutateAsync({
                    id: actor.id,
                    data: { name: name.trim(), slug: slug.trim(), description: description.trim() || undefined, color },
                });
                toast.success(t('actorUpdated'));
            } else {
                await createActor.mutateAsync({
                    projectId,
                    name: name.trim(),
                    slug: slug.trim(),
                    description: description.trim() || undefined,
                    color,
                });
                toast.success(t('actorCreated'));
            }
            onOpenChange(false);
        } catch {
            toast.error(isEditing ? t('actorUpdateFailed') : t('actorCreateFailed'));
        }
    }, [name, slug, description, color, isEditing, actor, projectId, createActor, updateActor, onOpenChange, t]);

    const handleOpenChange = useCallback((newOpen: boolean) => {
        onOpenChange(newOpen);
    }, [onOpenChange]);

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-base">{isEditing ? t('editTitle') : t('createTitle')}</DialogTitle>
                    <DialogDescription className="text-sm">
                        {isEditing ? t('editDescription') : t('createDescription')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium">{t('name')}</Label>
                        <Input
                            value={name}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleNameChange(e.target.value)}
                            placeholder={t('namePlaceholder')}
                            className="h-9"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium">{t('slug')}</Label>
                        <Input
                            value={slug}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSlugChange(e.target.value)}
                            placeholder={t('slugPlaceholder')}
                            className="h-9 font-mono text-sm"
                        />
                        <p className="text-xs text-foreground-muted">{t('slugHelp')}</p>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium">{t('description')}</Label>
                        <Input
                            value={description}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                            placeholder={t('descriptionPlaceholder')}
                            className="h-9"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium">{t('color')}</Label>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {ACTOR_COLORS.map((c) => (
                                <button
                                    key={c.name}
                                    type="button"
                                    onClick={() => setColor(c.name)}
                                    className={cn(
                                        'h-7 w-7 rounded-full flex items-center justify-center transition-all cursor-pointer',
                                        c.bg,
                                        color === c.name
                                            ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground/30 scale-110'
                                            : 'hover:scale-105'
                                    )}
                                >
                                    <span className={cn('h-3 w-3 rounded-full', c.dot)} />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} size="sm" className="cursor-pointer">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isPending || !name.trim() || !slug.trim()}
                        size="sm"
                        className="bg-accent-blue hover:bg-accent-blue/90 text-white cursor-pointer"
                    >
                        {isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                        {isEditing ? 'Save Changes' : 'Create Actor'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Main Actors Panel ───────────────────────────────────────────────────

interface ActorsPanelProps {
    projectId: string;
    className?: string;
}

export function ActorsPanel({ projectId, className }: ActorsPanelProps) {
    const t = useTranslations('Actors');

    const { data: actors, isLoading } = useActors(projectId);
    const deleteActor = useDeleteActor();

    const [formOpen, setFormOpen] = useState(false);
    const [editingActor, setEditingActor] = useState<Actor | undefined>();
    const [deletingActor, setDeletingActor] = useState<Actor | undefined>();

    const handleEdit = useCallback((actor: Actor) => {
        setEditingActor(actor);
        setFormOpen(true);
    }, []);

    const handleCreateNew = useCallback(() => {
        setEditingActor(undefined);
        setFormOpen(true);
    }, []);

    const handleDelete = useCallback(async () => {
        if (!deletingActor) return;
        try {
            await deleteActor.mutateAsync(deletingActor.id);
            toast.success(t('actorDeleted'));
        } catch {
            toast.error(t('actorDeleteFailed'));
        }
        setDeletingActor(undefined);
    }, [deletingActor, deleteActor, t]);

    if (isLoading) {
        return (
            <div className={cn("space-y-4", className)}>
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="rounded-xl border border-border/40 p-4 animate-pulse">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-foreground-muted/10" />
                            <div className="space-y-1.5 flex-1">
                                <div className="h-3.5 w-28 rounded bg-foreground-muted/10" />
                                <div className="h-2.5 w-48 rounded bg-foreground-muted/[0.06]" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    const actorsList = actors || [];

    return (
        <div className={cn("space-y-5", className)}>
            <ActorFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                projectId={projectId}
                actor={editingActor}
            />

            <AlertDialog open={!!deletingActor} onOpenChange={(open) => !open && setDeletingActor(undefined)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('deleteDescription', { name: deletingActor?.name || '' })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                        >
                            {deleteActor.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <UserCog className="h-4 w-4 text-accent-blue" />
                            <CardTitle className="text-sm">{t('title')}</CardTitle>
                        </div>
                        <Button
                            onClick={handleCreateNew}
                            size="sm"
                            className="h-7 gap-1.5 bg-accent-blue hover:bg-accent-blue/90 text-white text-xs cursor-pointer"
                        >
                            <Plus className="h-3 w-3" />
                            {t('newActor')}
                        </Button>
                    </div>
                    <CardDescription className="text-xs">
                        {t('description')}
                    </CardDescription>
                </CardHeader>

                <CardContent className="pt-0">
                    {actorsList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                            <div className="p-3 bg-foreground-muted/[0.06] rounded-full mb-3">
                                <UserCog className="h-6 w-6 text-foreground-muted" />
                            </div>
                            <p className="text-sm font-medium text-foreground">{t('noActorsFound')}</p>
                            <p className="text-xs text-foreground-muted mt-1 max-w-[300px]">{t('noActorsDescription')}</p>
                            <Button
                                onClick={handleCreateNew}
                                size="sm"
                                className="mt-4 h-8 gap-1.5 bg-accent-blue hover:bg-accent-blue/90 text-white cursor-pointer"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                {t('newActor')}
                            </Button>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/50">
                            {actorsList.map((actor) => {
                                const colorDef = getActorColor(actor.color);
                                return (
                                    <div key={actor.id} className="flex items-center justify-between py-3 group">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className={cn('h-8 w-8 rounded-full flex items-center justify-center shrink-0', colorDef.bg)}>
                                                <span className={cn('h-3 w-3 rounded-full', colorDef.dot)} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-foreground truncate">
                                                        {actor.name}
                                                    </span>
                                                    <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-4 shrink-0">
                                                        {actor.slug}
                                                    </Badge>
                                                </div>
                                                {actor.description && (
                                                    <p className="text-xs text-foreground-muted truncate mt-0.5">
                                                        {actor.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 cursor-pointer"
                                                onClick={() => handleEdit(actor)}
                                            >
                                                <Pencil className="h-3.5 w-3.5 text-foreground-muted" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 cursor-pointer hover:text-red-500"
                                                onClick={() => setDeletingActor(actor)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

