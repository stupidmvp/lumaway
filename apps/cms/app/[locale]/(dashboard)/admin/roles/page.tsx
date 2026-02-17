'use client';

import { useState, useEffect } from 'react';
import {
    useAdminRoles,
    useAdminCreateRole,
    useAdminUpdateRole,
    useAdminDeleteRole,
    useAdminRolePermissions,
    useAdminUpdateRolePermissions,
    useAdminPermissions,
    usePermissions,
    type AdminRole,
} from '@luma/infra';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
    Loader2,
    Shield,
    ShieldCheck,
    Plus,
    Pencil,
    Trash2,
    Lock,
    Users,
    Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { MainContent } from '@/components/shared/MainContent';
import { useTranslations } from 'next-intl';

export default function AdminRolesPage() {
    const t = useTranslations('AdminRoles');
    const tc = useTranslations('Common');
    const permissions = usePermissions();

    const { data: rolesData, isLoading: rolesLoading } = useAdminRoles();
    const { data: permissionsData } = useAdminPermissions();
    const createRole = useAdminCreateRole();
    const updateRole = useAdminUpdateRole();
    const deleteRole = useAdminDeleteRole();
    const updateRolePermissions = useAdminUpdateRolePermissions();

    // Create/Edit role dialog
    const [roleDialogOpen, setRoleDialogOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
    const [roleName, setRoleName] = useState('');
    const [roleDescription, setRoleDescription] = useState('');

    // Delete confirmation
    const [roleToDelete, setRoleToDelete] = useState<AdminRole | null>(null);

    // Permissions management
    const [permissionsRoleId, setPermissionsRoleId] = useState<string | null>(null);
    const [permissionsRoleName, setPermissionsRoleName] = useState('');
    const { data: rolePermsData, isLoading: rolePermsLoading } = useAdminRolePermissions(
        permissionsRoleId || ''
    );
    const [selectedPermIds, setSelectedPermIds] = useState<Set<string>>(new Set());

    const roles = rolesData?.data || [];
    const modulePermissions = permissionsData?.data || [];

    // Sync selected permissions when role permissions are loaded
    useEffect(() => {
        if (rolePermsData) {
            setSelectedPermIds(new Set(rolePermsData.permissions.map((p) => p.permissionId)));
        }
    }, [rolePermsData]);

    const canManage = permissions.isSuperAdmin();

    const openCreateDialog = () => {
        setEditingRole(null);
        setRoleName('');
        setRoleDescription('');
        setRoleDialogOpen(true);
    };

    const openEditDialog = (role: AdminRole) => {
        setEditingRole(role);
        setRoleName(role.name);
        setRoleDescription(role.description || '');
        setRoleDialogOpen(true);
    };

    const openPermissionsPanel = (role: AdminRole) => {
        setPermissionsRoleId(role.id);
        setPermissionsRoleName(role.name);
    };

    const handleSaveRole = async () => {
        if (!roleName.trim()) return;
        try {
            if (editingRole) {
                await updateRole.mutateAsync({
                    id: editingRole.id,
                    data: { name: roleName.trim(), description: roleDescription.trim() || undefined },
                });
                toast.success(t('roleUpdated'));
            } else {
                await createRole.mutateAsync({
                    name: roleName.trim(),
                    description: roleDescription.trim() || undefined,
                });
                toast.success(t('roleCreated'));
            }
            setRoleDialogOpen(false);
        } catch {
            toast.error(editingRole ? t('roleUpdateFailed') : t('roleCreateFailed'));
        }
    };

    const handleDeleteRole = async () => {
        if (!roleToDelete) return;
        try {
            await deleteRole.mutateAsync(roleToDelete.id);
            toast.success(t('roleDeleted'));
        } catch {
            toast.error(t('roleDeleteFailed'));
        } finally {
            setRoleToDelete(null);
        }
    };

    const togglePermission = (permId: string) => {
        setSelectedPermIds((prev) => {
            const next = new Set(prev);
            if (next.has(permId)) {
                next.delete(permId);
            } else {
                next.add(permId);
            }
            return next;
        });
    };

    const toggleModuleAll = (modulePerms: { id: string }[]) => {
        const allSelected = modulePerms.every((p) => selectedPermIds.has(p.id));
        setSelectedPermIds((prev) => {
            const next = new Set(prev);
            if (allSelected) {
                modulePerms.forEach((p) => next.delete(p.id));
            } else {
                modulePerms.forEach((p) => next.add(p.id));
            }
            return next;
        });
    };

    const handleSavePermissions = async () => {
        if (!permissionsRoleId) return;
        try {
            await updateRolePermissions.mutateAsync({
                roleId: permissionsRoleId,
                permissionIds: Array.from(selectedPermIds),
            });
            toast.success(t('permissionsUpdated'));
            setPermissionsRoleId(null);
        } catch {
            toast.error(t('permissionsUpdateFailed'));
        }
    };

    // Permission guard
    if (!canManage) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-foreground-muted text-sm">You do not have permission to access this page.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background transition-colors duration-300">
            <header className="h-14 bg-background border-b border-border flex justify-between items-center px-4 shadow-sm z-20 shrink-0 sticky top-0">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-accent-blue/10 flex items-center justify-center">
                        <Shield className="h-4 w-4 text-accent-blue" />
                    </div>
                    <h1 className="text-lg font-semibold text-foreground">{t('title')}</h1>
                </div>
                <Button
                    onClick={openCreateDialog}
                    className="h-9 px-4 gap-2 bg-accent-blue hover:bg-accent-blue/90 text-white shadow-sm cursor-pointer"
                >
                    <Plus className="h-4 w-4" />
                    <span className="text-sm font-medium">{t('createRole')}</span>
                </Button>
            </header>

            <MainContent maxWidth="max-w-4xl">
                <div className="space-y-4">
                    <p className="text-sm text-foreground-muted">{t('description')}</p>

                    {rolesLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-6 w-6 animate-spin text-accent-blue" />
                        </div>
                    ) : roles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <div className="h-12 w-12 rounded-full bg-foreground-muted/5 flex items-center justify-center mb-3">
                                <Shield className="h-6 w-6 text-foreground-muted/40" />
                            </div>
                            <p className="text-sm font-medium text-foreground mb-1">{t('noRolesFound')}</p>
                            <p className="text-xs text-foreground-muted">{t('noRolesDescription')}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {roles.map((role) => {
                                const isSuperadmin = role.name === 'superadmin';
                                return (
                                    <div
                                        key={role.id}
                                        className="flex items-center gap-4 px-4 py-3.5 rounded-xl border border-border bg-background hover:bg-background-secondary/30 transition-colors group"
                                    >
                                        <div
                                            className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                                                isSuperadmin ? 'bg-amber-500/10' : 'bg-accent-blue/10'
                                            }`}
                                        >
                                            {isSuperadmin ? (
                                                <ShieldCheck className="h-5 w-5 text-amber-500" />
                                            ) : (
                                                <Shield className="h-5 w-5 text-accent-blue" />
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-foreground">
                                                    {role.name}
                                                </span>
                                                {isSuperadmin && (
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-500/20"
                                                    >
                                                        System
                                                    </Badge>
                                                )}
                                            </div>
                                            {role.description && (
                                                <p className="text-xs text-foreground-muted mt-0.5 truncate">
                                                    {role.description}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-3 mt-1.5">
                                                <span className="text-[11px] text-foreground-muted flex items-center gap-1">
                                                    <Users className="h-3 w-3" />
                                                    {t('usersCount', { count: role.usersCount ?? 0 })}
                                                </span>
                                                <span className="text-[11px] text-foreground-muted flex items-center gap-1">
                                                    <Lock className="h-3 w-3" />
                                                    {t('permissionsCount', { count: role.permissionsCount ?? 0 })}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 px-2.5 text-xs gap-1.5 cursor-pointer"
                                                onClick={() => openPermissionsPanel(role)}
                                            >
                                                <Lock className="h-3.5 w-3.5" />
                                                {t('managePermissions')}
                                            </Button>
                                            {!isSuperadmin && (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 cursor-pointer"
                                                        onClick={() => openEditDialog(role)}
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 text-foreground-muted hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                                                        onClick={() => setRoleToDelete(role)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </MainContent>

            {/* Create/Edit Role Dialog */}
            <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {editingRole ? t('editRoleTitle') : t('createRoleTitle')}
                        </DialogTitle>
                        <DialogDescription>
                            {editingRole ? t('editRoleDescription') : t('createRoleDescription')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="roleName">{t('roleName')}</Label>
                            <Input
                                id="roleName"
                                value={roleName}
                                onChange={(e) =>
                                    setRoleName(
                                        e.target.value
                                            .toLowerCase()
                                            .replace(/[^a-z0-9-_]/g, '-')
                                    )
                                }
                                placeholder={t('roleNamePlaceholder')}
                                disabled={editingRole?.name === 'superadmin'}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="roleDescription">{t('roleDescription')}</Label>
                            <Input
                                id="roleDescription"
                                value={roleDescription}
                                onChange={(e) => setRoleDescription(e.target.value)}
                                placeholder={t('roleDescriptionPlaceholder')}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setRoleDialogOpen(false)}
                            className="h-9"
                        >
                            {tc('cancel')}
                        </Button>
                        <Button
                            onClick={handleSaveRole}
                            disabled={!roleName.trim() || createRole.isPending || updateRole.isPending}
                            className="h-9 bg-accent-blue hover:bg-accent-blue/90 text-white"
                        >
                            {(createRole.isPending || updateRole.isPending) && (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            )}
                            {tc('save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Role Confirmation */}
            <AlertDialog
                open={!!roleToDelete}
                onOpenChange={(open) => !open && setRoleToDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteRoleTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('deleteRoleDescription', { name: roleToDelete?.name || '' })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteRole}
                            className="bg-red-500 hover:bg-red-600 text-white"
                        >
                            {deleteRole.isPending && (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            )}
                            {tc('delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Permissions Management Dialog */}
            <Dialog
                open={!!permissionsRoleId}
                onOpenChange={(open) => !open && setPermissionsRoleId(null)}
            >
                <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>
                            {t('permissionsTitle', { name: permissionsRoleName })}
                        </DialogTitle>
                        <DialogDescription>{t('permissionsDescription')}</DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto py-2 space-y-4 min-h-0">
                        {rolePermsLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-accent-blue" />
                            </div>
                        ) : (
                            modulePermissions.map((group) => {
                                const allModuleSelected = group.permissions.every((p) =>
                                    selectedPermIds.has(p.id)
                                );
                                const someModuleSelected =
                                    !allModuleSelected &&
                                    group.permissions.some((p) => selectedPermIds.has(p.id));

                                return (
                                    <div
                                        key={group.module.id}
                                        className="rounded-lg border border-border overflow-hidden"
                                    >
                                        {/* Module header */}
                                        <button
                                            type="button"
                                            onClick={() => toggleModuleAll(group.permissions)}
                                            className="w-full flex items-center gap-3 px-4 py-3 bg-background-secondary/50 hover:bg-background-secondary transition-colors cursor-pointer"
                                        >
                                            <div
                                                className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                                    allModuleSelected
                                                        ? 'bg-accent-blue border-accent-blue'
                                                        : someModuleSelected
                                                          ? 'bg-accent-blue/30 border-accent-blue'
                                                          : 'border-border'
                                                }`}
                                            >
                                                {(allModuleSelected || someModuleSelected) && (
                                                    <Check className="h-3 w-3 text-white" />
                                                )}
                                            </div>
                                            <span className="text-sm font-semibold text-foreground capitalize">
                                                {group.module.name}
                                            </span>
                                            <Badge variant="secondary" className="text-[10px] ml-auto">
                                                {group.permissions.filter((p) =>
                                                    selectedPermIds.has(p.id)
                                                ).length}
                                                /{group.permissions.length}
                                            </Badge>
                                        </button>

                                        {/* Permissions list */}
                                        <div className="divide-y divide-border">
                                            {group.permissions.map((perm) => {
                                                const isChecked = selectedPermIds.has(perm.id);
                                                return (
                                                    <button
                                                        key={perm.id}
                                                        type="button"
                                                        onClick={() => togglePermission(perm.id)}
                                                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-background-secondary/30 transition-colors text-left cursor-pointer"
                                                    >
                                                        <div
                                                            className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                                                isChecked
                                                                    ? 'bg-accent-blue border-accent-blue'
                                                                    : 'border-border'
                                                            }`}
                                                        >
                                                            {isChecked && (
                                                                <Check className="h-3 w-3 text-white" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-xs font-medium text-foreground">
                                                                {perm.name}
                                                            </span>
                                                            {perm.description && (
                                                                <p className="text-[11px] text-foreground-muted truncate">
                                                                    {perm.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <DialogFooter className="border-t border-border pt-4">
                        <Button
                            variant="outline"
                            onClick={() => setPermissionsRoleId(null)}
                            className="h-9"
                        >
                            {tc('cancel')}
                        </Button>
                        <Button
                            onClick={handleSavePermissions}
                            disabled={updateRolePermissions.isPending}
                            className="h-9 bg-accent-blue hover:bg-accent-blue/90 text-white"
                        >
                            {updateRolePermissions.isPending && (
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
