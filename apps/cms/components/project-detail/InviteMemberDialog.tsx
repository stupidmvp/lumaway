'use client';

import { useState, useCallback } from 'react';
import { useCreateInvitation } from '@luma/infra';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Autocomplete } from '@/components/ui/autocomplete';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Loader2, Mail, Pencil, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

interface InviteMemberDialogProps {
    projectId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function InviteMemberDialog({ projectId, open, onOpenChange }: InviteMemberDialogProps) {
    const t = useTranslations('Members');
    const tc = useTranslations('Common');

    const [selectedUserId, setSelectedUserId] = useState<string | number>('');
    const [selectedUserEmail, setSelectedUserEmail] = useState('');
    const [role, setRole] = useState<string>('editor');

    const createInvitation = useCreateInvitation();

    const reset = useCallback(() => {
        setSelectedUserId('');
        setSelectedUserEmail('');
        setRole('editor');
    }, []);

    const handleInvite = async () => {
        if (!selectedUserEmail.trim()) return;
        try {
            await createInvitation.mutateAsync({ projectId, email: selectedUserEmail.trim(), role });
            toast.success(t('invitationSent'));
            reset();
            onOpenChange(false);
        } catch (error: any) {
            const msg =
                error?.response?.data?.error?.message ||
                error?.response?.data?.message ||
                error?.message ||
                t('invitationFailed');
            toast.error(msg);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('inviteTitle')}</DialogTitle>
                    <DialogDescription>{t('inviteDescription')}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                    <div>
                        <Autocomplete
                            service="users"
                            optionValue="id"
                            optionLabel="email"
                            placeholder={t('searchPlaceholder')}
                            value={selectedUserId}
                            onValueChange={(value, item) => {
                                if (item) {
                                    setSelectedUserId(value);
                                    setSelectedUserEmail(item.email);
                                } else {
                                    setSelectedUserId('');
                                    setSelectedUserEmail(value as string);
                                }
                            }}
                            triggerClassName="h-auto min-h-9 py-2 border-input bg-transparent"
                            freeSolo
                            freeSoloValidator={(v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)}
                            freeSoloLabel={(email) => (
                                <div className="flex items-center gap-2">
                                    <Mail className="h-3.5 w-3.5 text-accent-blue" />
                                    <span>{t('inviteByEmail', { email })}</span>
                                </div>
                            )}
                            renderOptionLabel={(item) => {
                                const name = [item.firstName, item.lastName].filter(Boolean).join(' ');
                                return (
                                    <div className="flex items-center gap-2">
                                        <UserAvatar
                                            firstName={item.firstName}
                                            lastName={item.lastName}
                                            avatar={item.avatar}
                                            size="xs"
                                        />
                                        <div className="flex flex-col min-w-0">
                                            {name && <span className="text-sm font-medium truncate">{name}</span>}
                                            <span className="text-xs text-foreground-muted truncate">{item.email}</span>
                                        </div>
                                    </div>
                                );
                            }}
                            limit={10}
                        />
                    </div>

                    <div>
                        <Select value={role} onValueChange={setRole}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder={t('rolePlaceholder')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="editor">
                                    <div className="flex items-center gap-2">
                                        <Pencil className="h-3 w-3" />
                                        <span>{t('roleEditor')}</span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="viewer">
                                    <div className="flex items-center gap-2">
                                        <Eye className="h-3 w-3" />
                                        <span>{t('roleViewer')}</span>
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => { onOpenChange(false); reset(); }}>
                        {tc('cancel')}
                    </Button>
                    <Button
                        onClick={handleInvite}
                        disabled={!selectedUserEmail.trim() || createInvitation.isPending}
                        className="gap-2 bg-accent-blue hover:bg-accent-blue/90 text-white cursor-pointer"
                    >
                        {createInvitation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Mail className="h-4 w-4" />
                        )}
                        {createInvitation.isPending ? t('sending') : t('sendInvitation')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

