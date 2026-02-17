'use client';

import { useState } from 'react';
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
import { Autocomplete } from '@/components/ui/autocomplete';
import { useCreateApiKey } from '@luma/infra';
import { Key, Check, Copy, Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface CreateApiKeyModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateApiKeyModal({ open, onOpenChange }: CreateApiKeyModalProps) {
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [name, setName] = useState<string>('');
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const t = useTranslations('ApiKeyModal');
    const tc = useTranslations('Common');

    const createApiKeyMutation = useCreateApiKey();

    const handleCreate = async () => {
        if (!selectedProjectId) return;

        try {
            const result = await createApiKeyMutation.mutateAsync({
                projectId: selectedProjectId,
                name: name || 'Default Key'
            });
            setGeneratedKey(result.key);
        } catch (error) {
            console.error('Failed to create API key:', error);
        }
    };

    const handleCopy = () => {
        if (generatedKey) {
            navigator.clipboard.writeText(generatedKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const reset = () => {
        setGeneratedKey(null);
        setSelectedProjectId('');
        setName('');
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
                        <Key className="h-5 w-5 text-accent-blue" />
                        {t('title')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('description')}
                    </DialogDescription>
                </DialogHeader>

                {!generatedKey ? (
                    <div className="grid gap-6 py-4">
                        <Autocomplete
                            service="projects"
                            label={t('selectProject')}
                            value={selectedProjectId}
                            onValueChange={(val) => setSelectedProjectId(val as string)}
                            placeholder={t('selectProjectPlaceholder')}
                            optionLabel="name"
                            optionValue="id"
                            filterDefaultValues={{ status: 'active' }}
                        />

                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none">
                                {t('friendlyName')}
                            </label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={t('friendlyNamePlaceholder')}
                            />
                            <p className="text-[11px] text-foreground-subtle">
                                {t('friendlyNameHelp')}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-6 py-4 fade-in animate-in slide-in-from-bottom-2 duration-300">
                        <div className="p-4 bg-accent-green/10 border border-accent-green/20 rounded-xl flex items-start gap-3">
                            <Check className="h-5 w-5 text-accent-green shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-accent-green">
                                    {t('keyGeneratedTitle')}
                                </p>
                                <p className="text-xs text-accent-green/80">
                                    {t('keyGeneratedDescription')}
                                </p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none">
                                {t('apiKey')}
                            </label>
                            <div className="flex gap-2">
                                <div className="flex-1 p-3 bg-background-secondary border border-border rounded-lg font-mono text-sm break-all">
                                    {generatedKey}
                                </div>
                            </div>
                            <Button
                                variant="secondary"
                                onClick={handleCopy}
                                className="w-full h-11 gap-2 mt-2"
                            >
                                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                {copied ? t('copiedToClipboard') : t('copyKey')}
                            </Button>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {!generatedKey ? (
                        <Button
                            onClick={handleCreate}
                            disabled={!selectedProjectId || createApiKeyMutation.isPending}
                            className="w-full h-11"
                        >
                            {createApiKeyMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {t('generating')}
                                </>
                            ) : (
                                <>
                                    <Plus className="mr-2 h-4 w-4" />
                                    {t('generateApiKey')}
                                </>
                            )}
                        </Button>
                    ) : (
                        <Button onClick={reset} className="w-full h-11">
                            {tc('done')}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
