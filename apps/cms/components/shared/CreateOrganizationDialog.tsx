'use client';

import { useState, useEffect } from 'react';
import { useCreateOrganization } from '@luma/infra';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

interface CreateOrganizationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated?: (org: { id: string; name: string; slug: string }) => void;
}

export function CreateOrganizationDialog({ open, onOpenChange, onCreated }: CreateOrganizationDialogProps) {
    const t = useTranslations('Organization');
    const tc = useTranslations('Common');
    const createOrganization = useCreateOrganization();

    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

    // Auto-generate slug from name
    useEffect(() => {
        if (!slugManuallyEdited && name) {
            const autoSlug = name
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            setSlug(autoSlug);
        }
    }, [name, slugManuallyEdited]);

    const handleSlugChange = (value: string) => {
        setSlugManuallyEdited(true);
        setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
    };

    const reset = () => {
        setName('');
        setSlug('');
        setSlugManuallyEdited(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !slug) return;

        try {
            const org = await createOrganization.mutateAsync({ name, slug });
            toast.success(t('organizationCreated'));
            reset();
            onOpenChange(false);
            onCreated?.(org);
        } catch (error: any) {
            const message = error?.response?.data?.error || t('organizationCreateFailed');
            toast.error(message);
        }
    };

    const slugValid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
    const canSubmit = name.trim().length > 0 && slug.length > 0 && slugValid && !createOrganization.isPending;

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) reset();
            onOpenChange(val);
        }}>
            <DialogContent className="sm:max-w-[460px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-accent-blue" />
                        {t('createOrganizationTitle')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('createOrganizationDescription')}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="space-y-2">
                        <Label htmlFor="orgName">{t('name')}</Label>
                        <Input
                            id="orgName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t('namePlaceholder')}
                            className="h-10"
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="orgSlug">{t('slug')}</Label>
                        <Input
                            id="orgSlug"
                            value={slug}
                            onChange={(e) => handleSlugChange(e.target.value)}
                            placeholder={t('slugPlaceholder')}
                            className="h-10"
                        />
                        <p className="text-[11px] text-foreground-subtle">
                            {t('slugHelp')}
                        </p>
                        {slug && !slugValid && (
                            <p className="text-[11px] text-destructive">
                                {t('slugHelp')}
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button
                            type="submit"
                            disabled={!canSubmit}
                            className="bg-accent-blue hover:bg-accent-blue/90 cursor-pointer"
                        >
                            {createOrganization.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Plus className="h-4 w-4 mr-2" />
                            )}
                            {t('createOrganization')}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

