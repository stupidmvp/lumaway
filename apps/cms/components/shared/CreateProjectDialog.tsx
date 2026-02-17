
import { useState } from 'react';
import { useCreateProject } from '@luma/infra';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, FolderKanban } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useTranslations } from 'next-intl';

interface CreateProjectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
    const [name, setName] = useState('');
    const createProjectMutation = useCreateProject();
    const t = useTranslations('CreateProject');

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!name) return;

        try {
            await createProjectMutation.mutateAsync(name);
            setName('');
            onOpenChange(false);
            toast.success(t('projectCreated'));
        } catch (e) {
            console.error('Failed to create project:', e);
            toast.error(t('projectCreateFailed'));
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('title')}</DialogTitle>
                    <DialogDescription>
                        {t('description')}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center justify-center py-6">
                    <div className="h-12 w-12 rounded-xl bg-accent-blue/10 text-accent-blue flex items-center justify-center mb-4">
                        <FolderKanban className="h-6 w-6" />
                    </div>
                </div>
                <form onSubmit={handleCreate} className="space-y-4">
                    <div className="space-y-2">
                        <Input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder={t('placeholder')}
                            className="h-10"
                            autoFocus
                        />
                        <div className="flex justify-end pt-2">
                            <Button
                                type="submit"
                                disabled={!name || createProjectMutation.isPending}
                                className="bg-accent-blue hover:bg-accent-blue/90 cursor-pointer"
                            >
                                {createProjectMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <Plus className="h-4 w-4 mr-2" />
                                )}
                                {t('createProject')}
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
