'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateWalkthrough } from '@luma/infra';
import { GitPullRequest, Loader2, Plus } from 'lucide-react';
import { Autocomplete } from '@/components/ui/autocomplete';
import { useTranslations } from 'next-intl';

interface CreateWalkthroughModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialProjectId?: string;
}

export function CreateWalkthroughModal({ open, onOpenChange, initialProjectId }: CreateWalkthroughModalProps) {
    const router = useRouter();
    const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || '');
    const [title, setTitle] = useState<string>('');
    const t = useTranslations('CreateWalkthroughModal');

    const createWalkthroughMutation = useCreateWalkthrough();

    const handleCreate = async () => {
        if (!selectedProjectId || !title) return;

        try {
            const result = await createWalkthroughMutation.mutateAsync({
                projectId: selectedProjectId,
                title,
                steps: []
            });

            onOpenChange(false);
            reset();

            // Redirect to editor
            router.push(`/walkthroughs/${result.id}`);
        } catch (error) {
            console.error('Failed to create walkthrough:', error);
        }
    };

    const reset = () => {
        setSelectedProjectId(initialProjectId || '');
        setTitle('');
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) reset();
            else onOpenChange(val);
        }}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <GitPullRequest className="h-5 w-5 text-accent-blue" />
                        {t('title')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('description')}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none">
                            {t('selectProject')}
                        </label>
                        <Autocomplete
                            service="projects"
                            value={selectedProjectId}
                            onValueChange={(val) => setSelectedProjectId(val as string)}
                            placeholder={t('selectProjectPlaceholder')}
                            optionLabel="name"
                            optionValue="id"
                            disabled={!!initialProjectId}
                            filterDefaultValues={{ status: 'active' }}
                            className="max-w-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none">
                            {t('walkthroughTitle')}
                        </label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={t('walkthroughTitlePlaceholder')}
                            autoFocus
                        />
                        <p className="text-[11px] text-foreground-subtle">
                            {t('walkthroughTitleHelp')}
                        </p>
                    </div>
                </div>

                <DialogFooter className="pt-2">
                    <Button
                        onClick={handleCreate}
                        disabled={!selectedProjectId || !title || createWalkthroughMutation.isPending}
                        className="w-full h-11"
                    >
                        {createWalkthroughMutation.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {t('creating')}
                            </>
                        ) : (
                            <>
                                <Plus className="mr-2 h-4 w-4" />
                                {t('createWalkthrough')}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
