
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GitPullRequest, Loader2, Plus } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useTranslations } from 'next-intl';

interface CreateWalkthroughDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
}

export function CreateWalkthroughDialog({ open, onOpenChange, projectId }: CreateWalkthroughDialogProps) {
    const [newWalkthroughTitle, setNewWalkthroughTitle] = useState('');
    const queryClient = useQueryClient();
    const t = useTranslations('CreateWalkthrough');

    const createWalkthroughMutation = useMutation({
        mutationFn: (data: any) => fetchAPI('/walkthroughs', { method: 'POST', body: JSON.stringify(data) }),
        onSuccess: () => {
            setNewWalkthroughTitle('');
            onOpenChange(false);
            toast.success(t('walkthroughCreated'));
            queryClient.invalidateQueries({ queryKey: ['walkthroughs'] });
        },
        onError: () => {
            toast.error(t('walkthroughCreateFailed'));
        }
    });

    async function handleCreateWalkthrough(e: React.FormEvent) {
        e.preventDefault();
        if (!newWalkthroughTitle) return;
        createWalkthroughMutation.mutate({ projectId, title: newWalkthroughTitle, steps: [] });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <GitPullRequest className="h-5 w-5 text-accent-blue" />
                        {t('title')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('description')}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateWalkthrough} className="space-y-4 mt-2">
                    <div className="space-y-2">
                        <Input
                            value={newWalkthroughTitle}
                            onChange={e => setNewWalkthroughTitle(e.target.value)}
                            placeholder={t('placeholder')}
                            className="h-10"
                            autoFocus
                        />
                        <div className="flex justify-end pt-2">
                            <Button
                                type="submit"
                                disabled={!newWalkthroughTitle || createWalkthroughMutation.isPending}
                                className="bg-accent-blue hover:bg-accent-blue/90"
                            >
                                {createWalkthroughMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <Plus className="h-4 w-4 mr-2" />
                                )}
                                {t('createWalkthrough')}
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
