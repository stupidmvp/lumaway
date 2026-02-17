'use client';

import { useState, useMemo } from 'react';
import {
    useAdminUsers,
    useAdminUpdateUser,
    useAdminUpdateUserRoles,
    useAdminRoles,
    usePermissions,
    AdminUser,
} from '@luma/infra';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
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
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell,
} from '@/components/ui/table';
import {
    Loader2,
    Users,
    ShieldCheck,
    Shield,
    UserCog,
    ChevronLeft,
    ChevronRight,
    CircleCheck,
    CirclePause,
    Ban,
} from 'lucide-react';
import { toast } from 'sonner';
import { MainContent } from '@/components/shared/MainContent';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
    active: { icon: CircleCheck, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
    inactive: { icon: CirclePause, color: 'text-amber-600', bg: 'bg-amber-500/10' },
    suspended: { icon: Ban, color: 'text-red-600', bg: 'bg-red-500/10' },
};

export default function AdminUsersPage() {
    const t = useTranslations('AdminUsers');
    const tc = useTranslations('Common');
    const permissions = usePermissions();
    const router = useRouter();

    // Redirect non-superadmins
    if (!permissions.isSuperAdmin()) {
        router.replace('/');
        return null;
    }

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [page, setPage] = useState(0);
    const pageSize = 20;

    // Debounce search
    const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (debounceTimer) clearTimeout(debounceTimer);
        const timer = setTimeout(() => {
            setDebouncedSearch(value);
            setPage(0);
        }, 300);
        setDebounceTimer(timer);
    };

    const { data: usersData, isLoading } = useAdminUsers({
        search: debouncedSearch || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        $limit: pageSize,
        $skip: page * pageSize,
    });

    const { data: rolesData } = useAdminRoles();
    const updateUser = useAdminUpdateUser();
    const updateUserRoles = useAdminUpdateUserRoles();

    const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
    const [editStatus, setEditStatus] = useState<string>('active');
    const [editRoleIds, setEditRoleIds] = useState<string[]>([]);

    const users = usersData?.data || [];
    const total = usersData?.total || 0;
    const totalPages = Math.ceil(total / pageSize);
    const allRoles = rolesData?.data || [];

    const openEditDialog = (user: AdminUser) => {
        setEditingUser(user);
        setEditStatus(user.status);
        // We need to find role IDs from role names
        const roleIds = allRoles
            .filter((r) => user.globalRoles.includes(r.name))
            .map((r) => r.id);
        setEditRoleIds(roleIds);
    };

    const handleSaveUser = async () => {
        if (!editingUser) return;
        try {
            // Update status if changed
            if (editStatus !== editingUser.status) {
                await updateUser.mutateAsync({
                    id: editingUser.id,
                    data: { status: editStatus },
                });
            }

            // Update roles
            const currentRoleIds = allRoles
                .filter((r) => editingUser.globalRoles.includes(r.name))
                .map((r) => r.id);
            const rolesChanged =
                JSON.stringify([...currentRoleIds].sort()) !== JSON.stringify([...editRoleIds].sort());

            if (rolesChanged) {
                await updateUserRoles.mutateAsync({
                    userId: editingUser.id,
                    roleIds: editRoleIds,
                });
                toast.success(t('rolesUpdated'));
            } else if (editStatus !== editingUser.status) {
                toast.success(t('userUpdated'));
            }

            setEditingUser(null);
        } catch {
            toast.error(t('userUpdateFailed'));
        }
    };

    const toggleRole = (roleId: string) => {
        setEditRoleIds((prev) =>
            prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
        );
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <div className="flex flex-col h-full bg-background transition-colors duration-300">
            <header className="h-14 bg-background border-b border-border flex justify-between items-center px-4 shadow-sm z-20 shrink-0 sticky top-0">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-accent-blue/10 flex items-center justify-center">
                        <Users className="h-4 w-4 text-accent-blue" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-foreground">{t('title')}</h1>
                    </div>
                </div>
                {total > 0 && (
                    <span className="text-xs text-foreground-muted font-medium">
                        {t('usersCount', { count: total })}
                    </span>
                )}
            </header>

            <MainContent maxWidth="max-w-6xl">
                <div className="space-y-4">
                    {/* Toolbar */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="w-full sm:w-80">
                            <SearchInput
                                value={search}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                onClear={() => {
                                    setSearch('');
                                    setDebouncedSearch('');
                                    setPage(0);
                                }}
                                placeholder={t('searchPlaceholder')}
                                className="h-9 text-[13px]"
                            />
                        </div>
                        <Select
                            value={statusFilter}
                            onValueChange={(val) => {
                                setStatusFilter(val);
                                setPage(0);
                            }}
                        >
                            <SelectTrigger className="h-9 w-auto min-w-[160px] text-xs">
                                <SelectValue placeholder={t('allStatuses')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('allStatuses')}</SelectItem>
                                <SelectItem value="active">
                                    <div className="flex items-center gap-2">
                                        <CircleCheck className="h-3 w-3 text-emerald-600" />
                                        {t('active')}
                                    </div>
                                </SelectItem>
                                <SelectItem value="inactive">
                                    <div className="flex items-center gap-2">
                                        <CirclePause className="h-3 w-3 text-amber-600" />
                                        {t('inactive')}
                                    </div>
                                </SelectItem>
                                <SelectItem value="suspended">
                                    <div className="flex items-center gap-2">
                                        <Ban className="h-3 w-3 text-red-600" />
                                        {t('suspended')}
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Table */}
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-6 w-6 animate-spin text-accent-blue" />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <div className="h-12 w-12 rounded-full bg-foreground-muted/5 flex items-center justify-center mb-3">
                                <Users className="h-6 w-6 text-foreground-muted/40" />
                            </div>
                            <p className="text-sm font-medium text-foreground mb-1">{t('noUsersFound')}</p>
                            <p className="text-xs text-foreground-muted">{t('noUsersDescription')}</p>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-border overflow-hidden bg-background">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                                            {t('name')}
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                                            {t('status')}
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                                            {t('roles')}
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                                            {t('organization')}
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                                            {t('joined')}
                                        </TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-foreground-muted w-[80px]">
                                            {t('actions')}
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map((user) => {
                                        const statusCfg = (STATUS_CONFIG[user.status] ?? STATUS_CONFIG.active)!;
                                        const StatusIcon = statusCfg.icon;
                                        const displayName =
                                            [user.firstName, user.lastName].filter(Boolean).join(' ') ||
                                            user.email;

                                        return (
                                            <TableRow key={user.id} className="group">
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <UserAvatar
                                                            firstName={user.firstName}
                                                            lastName={user.lastName}
                                                            avatar={user.avatar}
                                                            size="sm"
                                                        />
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium text-foreground truncate">
                                                                {displayName}
                                                            </p>
                                                            <p className="text-xs text-foreground-muted truncate">
                                                                {user.email}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div
                                                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}
                                                    >
                                                        <StatusIcon className="h-3 w-3" />
                                                        {t(user.status as any)}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {user.globalRoles.length === 0 ? (
                                                            <span className="text-xs text-foreground-muted italic">
                                                                {t('noRolesAssigned')}
                                                            </span>
                                                        ) : (
                                                            user.globalRoles.map((role) => (
                                                                <Badge
                                                                    key={role}
                                                                    variant="secondary"
                                                                    className={`text-[11px] px-1.5 py-0 ${
                                                                        role === 'superadmin'
                                                                            ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                                                            : 'bg-accent-blue/10 text-accent-blue border-accent-blue/20'
                                                                    }`}
                                                                >
                                                                    {role}
                                                                </Badge>
                                                            ))
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-xs text-foreground-muted">
                                                        {user.organizationName || t('noOrganization')}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-xs text-foreground-muted">
                                                        {formatDate(user.createdAt)}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => openEditDialog(user)}
                                                    >
                                                        <UserCog className="h-3.5 w-3.5 mr-1" />
                                                        <span className="text-xs">{tc('edit')}</span>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-2">
                            <p className="text-xs text-foreground-muted">
                                {tc('showing')} {page * pageSize + 1}-
                                {Math.min((page + 1) * pageSize, total)} {tc('of')} {total}{' '}
                                {tc('results')}
                            </p>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    disabled={page === 0}
                                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                </Button>
                                <span className="text-xs text-foreground-muted px-2">
                                    {tc('page')} {page + 1} {tc('of')} {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    disabled={page >= totalPages - 1}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </MainContent>

            {/* Edit User Dialog */}
            <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('editUser')}</DialogTitle>
                        <DialogDescription>{t('editUserDescription')}</DialogDescription>
                    </DialogHeader>

                    {editingUser && (
                        <div className="space-y-5 py-2">
                            {/* User info */}
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-background-secondary/50 border border-border">
                                <UserAvatar
                                    firstName={editingUser.firstName}
                                    lastName={editingUser.lastName}
                                    avatar={editingUser.avatar}
                                    size="md"
                                />
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">
                                        {[editingUser.firstName, editingUser.lastName]
                                            .filter(Boolean)
                                            .join(' ') || editingUser.email}
                                    </p>
                                    <p className="text-xs text-foreground-muted truncate">
                                        {editingUser.email}
                                    </p>
                                </div>
                            </div>

                            {/* Status */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                                    {t('userStatus')}
                                </Label>
                                <Select value={editStatus} onValueChange={setEditStatus}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">
                                            <div className="flex items-center gap-2">
                                                <CircleCheck className="h-3.5 w-3.5 text-emerald-600" />
                                                {t('active')}
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="inactive">
                                            <div className="flex items-center gap-2">
                                                <CirclePause className="h-3.5 w-3.5 text-amber-600" />
                                                {t('inactive')}
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="suspended">
                                            <div className="flex items-center gap-2">
                                                <Ban className="h-3.5 w-3.5 text-red-600" />
                                                {t('suspended')}
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Roles */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                                    {t('assignRoles')}
                                </Label>
                                <div className="space-y-1.5">
                                    {allRoles.map((role) => {
                                        const isChecked = editRoleIds.includes(role.id);
                                        const isSuperadmin = role.name === 'superadmin';
                                        return (
                                            <button
                                                key={role.id}
                                                type="button"
                                                onClick={() => toggleRole(role.id)}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left cursor-pointer ${
                                                    isChecked
                                                        ? 'border-accent-blue/40 bg-accent-blue/5'
                                                        : 'border-border hover:border-border hover:bg-background-secondary/30'
                                                }`}
                                            >
                                                <div
                                                    className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                                        isChecked
                                                            ? 'bg-accent-blue border-accent-blue'
                                                            : 'border-border'
                                                    }`}
                                                >
                                                    {isChecked && (
                                                        <svg
                                                            className="h-3 w-3 text-white"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                            strokeWidth={3}
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                d="M5 13l4 4L19 7"
                                                            />
                                                        </svg>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        {isSuperadmin ? (
                                                            <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
                                                        ) : (
                                                            <Shield className="h-3.5 w-3.5 text-accent-blue" />
                                                        )}
                                                        <span className="text-sm font-medium text-foreground">
                                                            {role.name}
                                                        </span>
                                                    </div>
                                                    {role.description && (
                                                        <p className="text-xs text-foreground-muted mt-0.5 truncate">
                                                            {role.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setEditingUser(null)}
                            className="h-9"
                        >
                            {tc('cancel')}
                        </Button>
                        <Button
                            onClick={handleSaveUser}
                            disabled={updateUser.isPending || updateUserRoles.isPending}
                            className="h-9 bg-accent-blue hover:bg-accent-blue/90 text-white"
                        >
                            {(updateUser.isPending || updateUserRoles.isPending) && (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            )}
                            {tc('save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}


