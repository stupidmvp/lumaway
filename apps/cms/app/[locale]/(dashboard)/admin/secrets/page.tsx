'use client';

import { useState } from 'react';
import {
    useSystemSecrets,
    useCreateSystemSecret,
    useUpdateSystemSecret,
    useDeleteSystemSecret,
    usePermissions,
    type SystemSecret,
} from '@luma/infra';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
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
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell,
} from '@/components/ui/table';
import {
    Loader2,
    KeyRound,
    Plus,
    Pencil,
    Trash2,
    Eye,
    EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { MainContent } from '@/components/shared/MainContent';
import { useRouter } from 'next/navigation';

const PROVIDER_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    groq: { label: 'Groq', color: 'text-orange-600', bg: 'bg-orange-500/10' },
    google: { label: 'Gemini', color: 'text-blue-600', bg: 'bg-blue-500/10' },
    openai: { label: 'OpenAI', color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
};

export default function AdminSecretsPage() {
    const permissions = usePermissions();
    const router = useRouter();

    // Guard: superadmin only
    if (!permissions.isSuperAdmin()) {
        router.replace('/');
        return null;
    }

    const { data: secretsData, isLoading } = useSystemSecrets();
    const createSecret = useCreateSystemSecret();
    const updateSecret = useUpdateSystemSecret();
    const deleteSecret = useDeleteSystemSecret();

    // Create/Edit dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingSecret, setEditingSecret] = useState<SystemSecret | null>(null);
    const [keyName, setKeyName] = useState('');
    const [keyValue, setKeyValue] = useState('');
    const [provider, setProvider] = useState('groq');
    const [showKeyValue, setShowKeyValue] = useState(false);

    // Delete confirmation
    const [secretToDelete, setSecretToDelete] = useState<SystemSecret | null>(null);

    const secrets = secretsData?.data || [];
    const total = secretsData?.total || 0;

    const openCreateDialog = () => {
        setEditingSecret(null);
        setKeyName('');
        setKeyValue('');
        setProvider('groq');
        setShowKeyValue(false);
        setDialogOpen(true);
    };

    const openEditDialog = (secret: SystemSecret) => {
        setEditingSecret(secret);
        setKeyName(secret.keyName);
        setKeyValue(''); // Don't pre-fill since it's redacted
        setProvider(secret.provider);
        setShowKeyValue(false);
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!keyName.trim()) return;
        try {
            if (editingSecret) {
                const updateData: { keyName?: string; keyValue?: string; provider?: string } = {};
                if (keyName.trim() !== editingSecret.keyName) updateData.keyName = keyName.trim();
                if (keyValue.trim()) updateData.keyValue = keyValue.trim();
                if (provider !== editingSecret.provider) updateData.provider = provider;

                if (Object.keys(updateData).length === 0) {
                    setDialogOpen(false);
                    return;
                }
                await updateSecret.mutateAsync({ id: editingSecret.id, data: updateData });
                toast.success('Secret updated successfully');
            } else {
                if (!keyValue.trim()) {
                    toast.error('API key value is required');
                    return;
                }
                await createSecret.mutateAsync({
                    keyName: keyName.trim(),
                    keyValue: keyValue.trim(),
                    provider,
                });
                toast.success('Secret created successfully');
            }
            setDialogOpen(false);
        } catch {
            toast.error(editingSecret ? 'Failed to update secret' : 'Failed to create secret');
        }
    };

    const handleDelete = async () => {
        if (!secretToDelete) return;
        try {
            await deleteSecret.mutateAsync(secretToDelete.id);
            toast.success('Secret deleted');
        } catch {
            toast.error('Failed to delete secret');
        } finally {
            setSecretToDelete(null);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="flex flex-col h-full bg-background transition-colors duration-300">
            <header className="h-14 bg-background border-b border-border flex justify-between items-center px-4 shadow-sm z-20 shrink-0 sticky top-0">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <KeyRound className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-foreground">System Secrets</h1>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {total > 0 && (
                        <span className="text-xs text-foreground-muted font-medium">
                            {total} secret{total !== 1 ? 's' : ''}
                        </span>
                    )}
                    <Button
                        onClick={openCreateDialog}
                        className="h-9 px-4 gap-2 bg-accent-blue hover:bg-accent-blue/90 text-white shadow-sm cursor-pointer"
                    >
                        <Plus className="h-4 w-4" />
                        <span className="text-sm font-medium">Add Secret</span>
                    </Button>
                </div>
            </header>

            <MainContent maxWidth="max-w-5xl">
                <div className="space-y-4">
                    <p className="text-sm text-foreground-muted">
                        Manage LLM API keys used by the AI engine. Keys are stored encrypted and redacted in API responses.
                    </p>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-6 w-6 animate-spin text-accent-blue" />
                        </div>
                    ) : secrets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <div className="h-12 w-12 rounded-full bg-foreground-muted/5 flex items-center justify-center mb-3">
                                <KeyRound className="h-6 w-6 text-foreground-muted/40" />
                            </div>
                            <p className="text-sm font-medium text-foreground mb-1">No secrets configured</p>
                            <p className="text-xs text-foreground-muted">Add your first API key to enable AI features.</p>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-border overflow-hidden bg-background">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                                            Key Name
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                                            Provider
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                                            Value
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                                            Updated
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-foreground-muted w-[100px]">
                                            Actions
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {secrets.map((secret) => {
                                        const providerCfg = PROVIDER_CONFIG[secret.provider] || {
                                            label: secret.provider,
                                            color: 'text-foreground-muted',
                                            bg: 'bg-foreground-muted/10',
                                        };
                                        return (
                                            <TableRow key={secret.id} className="group">
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <KeyRound className="h-3.5 w-3.5 text-foreground-muted/60 shrink-0" />
                                                        <span className="text-sm font-mono font-medium text-foreground">
                                                            {secret.keyName}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="secondary"
                                                        className={`text-[11px] px-2 py-0.5 ${providerCfg.bg} ${providerCfg.color} border-transparent`}
                                                    >
                                                        {providerCfg.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <code className="text-xs text-foreground-muted font-mono bg-background-secondary/50 px-2 py-0.5 rounded">
                                                        {secret.keyValue}
                                                    </code>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-xs text-foreground-muted">
                                                        {formatDate(secret.updatedAt)}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0 cursor-pointer"
                                                            onClick={() => openEditDialog(secret)}
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0 text-foreground-muted hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                                                            onClick={() => setSecretToDelete(secret)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </MainContent>

            {/* Create/Edit Secret Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {editingSecret ? 'Edit Secret' : 'Add Secret'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingSecret
                                ? 'Update the API key details. Leave the value empty to keep the current key.'
                                : 'Add a new LLM API key. The value will be encrypted and redacted in responses.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="keyName">Key Name</Label>
                            <Input
                                id="keyName"
                                value={keyName}
                                onChange={(e) =>
                                    setKeyName(
                                        e.target.value
                                            .toUpperCase()
                                            .replace(/[^A-Z0-9_]/g, '_')
                                    )
                                }
                                placeholder="e.g. GROQ_API_KEY_1"
                                className="font-mono"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="keyValue">
                                API Key {editingSecret && <span className="text-foreground-muted font-normal">(leave empty to keep current)</span>}
                            </Label>
                            <div className="relative">
                                <Input
                                    id="keyValue"
                                    type={showKeyValue ? 'text' : 'password'}
                                    value={keyValue}
                                    onChange={(e) => setKeyValue(e.target.value)}
                                    placeholder={editingSecret ? '••••••••••••' : 'sk-...'}
                                    className="font-mono pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowKeyValue(!showKeyValue)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground transition-colors"
                                >
                                    {showKeyValue ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="provider">Provider</Label>
                            <Select value={provider} onValueChange={setProvider}>
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="groq">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-orange-500" />
                                            Groq
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="google">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-blue-500" />
                                            Gemini (Google)
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="openai">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                            OpenAI
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDialogOpen(false)}
                            className="h-9"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={!keyName.trim() || (!editingSecret && !keyValue.trim()) || createSecret.isPending || updateSecret.isPending}
                            className="h-9 bg-accent-blue hover:bg-accent-blue/90 text-white"
                        >
                            {(createSecret.isPending || updateSecret.isPending) && (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            )}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog
                open={!!secretToDelete}
                onOpenChange={(open) => !open && setSecretToDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Secret</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>{secretToDelete?.keyName}</strong>?
                            This will immediately revoke access to this API key for the AI engine.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-red-500 hover:bg-red-600 text-white"
                        >
                            {deleteSecret.isPending && (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            )}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
