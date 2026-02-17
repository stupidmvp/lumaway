'use client';

import { useState, useEffect } from 'react';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    useApiKeys,
    useCreateApiKey,
    useUpdateApiKey,
    useDeleteApiKey,
    ApiKey
} from '@luma/infra';
import {
    Key,
    Check,
    Copy,
    Loader2,
    Save,
    Plus,
    Settings,
    Trash2,
    Eye,
    EyeOff,
    ChevronLeft,
    Search
} from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTranslations } from 'next-intl';

interface ApiKeyManagerDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
}

type View = 'list' | 'create' | 'edit' | 'success';

export function ApiKeyManagerDrawer({ open, onOpenChange, projectId }: ApiKeyManagerDrawerProps) {
    const [view, setView] = useState<View>('list');
    const [selectedApiKey, setSelectedApiKey] = useState<ApiKey | null>(null);
    const [name, setName] = useState('');
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [search, setSearch] = useState('');
    const t = useTranslations('ApiKeyDrawer');
    const tc = useTranslations('Common');

    const { data: apiKeysData, isLoading: apiKeysLoading } = useApiKeys(projectId);
    const createMutation = useCreateApiKey();
    const updateMutation = useUpdateApiKey();
    const deleteMutation = useDeleteApiKey();

    const apiKeys = Array.isArray(apiKeysData)
        ? apiKeysData
        : (apiKeysData as any)?.data || [];

    const filteredKeys = apiKeys.filter((k: ApiKey) =>
        k.name.toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
        if (open) {
            setView('list');
            setGeneratedKey(null);
            setName('');
            setSearch('');
            setShowKey(false);
        }
    }, [open]);

    const handleCreate = async () => {
        try {
            const result = await createMutation.mutateAsync({ projectId, name });
            setGeneratedKey(result.key);
            setView('success');
        } catch (error) {
            console.error('Failed to create API key:', error);
        }
    };

    const handleUpdate = async () => {
        if (!selectedApiKey) return;
        try {
            await updateMutation.mutateAsync({ id: selectedApiKey.id, name });
            setView('list');
        } catch (error) {
            console.error('Failed to update API key:', error);
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const renderList = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-subtle" />
                    <Input
                        placeholder={t('searchKeys')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 bg-background-secondary/50 border-none h-10"
                    />
                </div>
                <Button
                    size="sm"
                    onClick={() => {
                        setName('');
                        setView('create');
                    }}
                    className="h-10 rounded-lg px-4"
                >
                    <Plus className="h-4 w-4 mr-1" />
                    {t('newKey')}
                </Button>
            </div>

            <div className="grid gap-2 overflow-y-auto max-h-[calc(100vh-250px)] pr-1 custom-scrollbar">
                {apiKeysLoading ? (
                    <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-20 bg-background-secondary/50 rounded-xl animate-pulse border border-border" />
                        ))}
                    </div>
                ) : filteredKeys.length > 0 ? (
                    filteredKeys.map((key: ApiKey) => (
                        <div key={key.id} className="p-4 border border-border rounded-xl bg-background-secondary/30 flex items-center justify-between gap-3 transition-smooth hover:bg-background-secondary/50 group">
                            <div className="min-w-0">
                                <div className="font-medium text-sm text-foreground truncate mb-0.5">{key.name || t('untitledKey')}</div>
                                <div className="text-[10px] text-foreground-subtle uppercase tracking-wider font-semibold">
                                    {t('created', { date: new Date(key.createdAt).toLocaleDateString() })}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setSelectedApiKey(key);
                                        setName(key.name);
                                        setView('edit');
                                    }}
                                    className="h-8 w-8 p-0"
                                >
                                    <Settings className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>{t('deleteApiKey')}</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                {t('deleteApiKeyDescription')}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => deleteMutation.mutate(key.id)}
                                                className="bg-red-500 hover:bg-red-600"
                                            >
                                                {t('deleteKey')}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-10 border border-dashed border-border rounded-xl bg-background-secondary/10">
                        <Key className="h-8 w-8 text-foreground-subtle mx-auto mb-3 opacity-20" />
                        <p className="text-sm text-foreground-muted">{t('noKeysFound')}</p>
                    </div>
                )}
            </div>
        </div>
    );

    const renderCreate = () => (
        <div className="space-y-6 py-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setView('list')}
                className="mb-2 -ml-2 text-foreground-subtle hover:text-foreground"
            >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t('backToList')}
            </Button>
            <div className="space-y-2">
                <label className="text-sm font-medium leading-none">{t('friendlyName')}</label>
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('friendlyNamePlaceholder')}
                    autoFocus
                />
                <p className="text-[11px] text-foreground-subtle">
                    {t('friendlyNameHelp')}
                </p>
            </div>
            <Button
                onClick={handleCreate}
                disabled={!name || createMutation.isPending}
                className="w-full h-11"
            >
                {createMutation.isPending ? (
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
        </div>
    );

    const renderEdit = () => (
        <div className="space-y-6 py-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setView('list')}
                className="mb-2 -ml-2 text-foreground-subtle hover:text-foreground"
            >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t('backToList')}
            </Button>

            {/* API Key value — reveal + copy */}
            {selectedApiKey?.key && (
                <div className="space-y-2">
                    <label className="text-sm font-medium leading-none flex items-center gap-2">
                        {t('apiKey')}
                        <span className="text-[10px] bg-background-secondary border border-border px-1.5 py-0.5 rounded uppercase font-medium">{t('secret')}</span>
                    </label>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 p-2.5 bg-background-secondary border border-border rounded-lg font-mono text-xs break-all leading-relaxed select-all">
                            {showKey ? selectedApiKey.key : `${selectedApiKey.key.slice(0, 7)}${'•'.repeat(32)}`}
                        </div>
                        <div className="flex flex-col gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowKey(!showKey)}
                                className="h-8 w-8 p-0"
                            >
                                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopy(selectedApiKey.key)}
                                className="h-8 w-8 p-0"
                            >
                                {copied ? <Check className="h-3.5 w-3.5 text-accent-green" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                <label className="text-sm font-medium leading-none">{t('updateName')}</label>
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('updateNamePlaceholder')}
                    autoFocus
                />
            </div>
            <Button
                onClick={handleUpdate}
                disabled={!name || updateMutation.isPending}
                className="w-full h-11"
            >
                {updateMutation.isPending ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('updating')}
                    </>
                ) : (
                    <>
                        <Save className="mr-2 h-4 w-4" />
                        {t('updateKeyName')}
                    </>
                )}
            </Button>
        </div>
    );

    const renderSuccess = () => (
        <div className="space-y-6 py-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="p-4 bg-accent-green/10 border border-accent-green/20 rounded-xl flex items-start gap-3">
                <Check className="h-5 w-5 text-accent-green shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-accent-green">{t('keyGeneratedTitle')}</p>
                    <p className="text-xs text-accent-green/80">{t('keyGeneratedDescription')}</p>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium leading-none flex items-center gap-2">
                    {t('apiKey')}
                    <span className="text-[10px] bg-background-secondary border border-border px-1.5 py-0.5 rounded uppercase font-medium">{t('secret')}</span>
                </label>
                <div className="p-3 bg-background-secondary border border-border rounded-lg font-mono text-sm break-all leading-relaxed">
                    {generatedKey}
                </div>
                <Button variant="secondary" onClick={() => handleCopy(generatedKey!)} className="w-full h-11 gap-2 mt-2">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? t('copiedToClipboard') : t('copyKey')}
                </Button>
            </div>

            <Button onClick={() => setView('list')} className="w-full h-11">
                {tc('done')}
            </Button>
        </div>
    );

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-md">
                <SheetHeader className="mb-6">
                    <SheetTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5 text-accent-blue" />
                        {t('title')}
                    </SheetTitle>
                    <SheetDescription>
                        {view === 'list' && t('listDescription')}
                        {view === 'create' && t('createDescription')}
                        {view === 'edit' && t('editDescription')}
                        {view === 'success' && t('successDescription')}
                    </SheetDescription>
                </SheetHeader>

                {view === 'list' && renderList()}
                {view === 'create' && renderCreate()}
                {view === 'edit' && renderEdit()}
                {view === 'success' && renderSuccess()}
            </SheetContent>
        </Sheet>
    );
}
