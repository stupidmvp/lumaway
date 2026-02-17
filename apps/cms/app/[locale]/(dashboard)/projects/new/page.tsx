'use client';

import { useCreateProject } from '@luma/infra';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function NewProjectPage() {
    const router = useRouter();
    const createProject = useCreateProject();
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const t = useTranslations('NewProject');
    const tc = useTranslations('Common');

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim()) return;

        setIsLoading(true);
        try {
            const newProject = await createProject.mutateAsync(name);
            router.push(`/projects/${newProject.id}`);
        } catch (error) {
            console.error('Failed to create project:', error);
            setIsLoading(false);
        }
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background">
            <div className="w-full max-w-md p-8 space-y-6 bg-card border border-border rounded-lg shadow-sm">
                <div className="space-y-2 text-center">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('title')}</h1>
                    <p className="text-sm text-foreground-muted">{t('description')}</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">{t('projectNameLabel')}</Label>
                        <Input
                            id="name"
                            placeholder={t('projectNamePlaceholder')}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={isLoading}
                            required
                        />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading || !name.trim()}>
                        <Plus className="mr-2 h-4 w-4" />
                        {isLoading ? t('creating') : t('createProject')}
                    </Button>
                </form>
                <div className="text-center">
                    <Button
                        variant="link"
                        type="button"
                        className="text-foreground-muted"
                        onClick={() => router.back()}
                    >
                        {tc('cancel')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
