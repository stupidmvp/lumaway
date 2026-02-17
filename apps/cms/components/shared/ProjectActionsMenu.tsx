import * as React from 'react';
import { useState } from 'react';
import {
    MoreVertical,
    Pencil,
    Trash2,
    Loader2,
    Settings,
    Archive,
    RefreshCw,
    Key as KeyIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { ApiKeyManagerDrawer } from '@/components/drawers/ApiKeyManagerDrawer';
import { useUpdateProject, useDeleteProject, usePermissions } from '@luma/infra';
import { toast } from "sonner";
import { useTranslations } from 'next-intl';

interface ProjectActionsMenuProps extends React.HTMLAttributes<HTMLDivElement> {
    project: {
        id: string;
        name: string;
        organizationId?: string;
        status?: 'active' | 'archived';
    };
    onDeleteSuccess?: () => void;
    triggerClassName?: string;
}

export const ProjectActionsMenu = React.forwardRef<HTMLDivElement, ProjectActionsMenuProps>(
    ({ project, onDeleteSuccess, triggerClassName, className, ...props }, ref) => {
        const router = useRouter();
        const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
        const [renameDialogOpen, setRenameDialogOpen] = useState(false);
        const [apiKeysOpen, setApiKeysOpen] = useState(false);
        const [name, setName] = useState(project.name);
        const t = useTranslations('ProjectActions');
        const tc = useTranslations('Common');
        const permissions = usePermissions();

        const ctx = { projectId: project.id, organizationId: project.organizationId };
        const canEditProject = permissions.can('update', 'projects', ctx);
        const canDeleteProject = permissions.can('delete', 'projects', ctx);
        const canManageKeys = permissions.can('create', 'api_keys', ctx);
        const hasAnyAction = canEditProject || canDeleteProject || canManageKeys;

        const updateProjectMutation = useUpdateProject();
        const deleteProjectMutation = useDeleteProject();

        const handleRename = async (e: React.FormEvent) => {
            e.preventDefault();
            if (!name || name === project.name) {
                setRenameDialogOpen(false);
                return;
            }

            try {
                await updateProjectMutation.mutateAsync({
                    id: project.id,
                    data: { name }
                });
                toast.success(t('projectRenamed'));
                setRenameDialogOpen(false);
            } catch (error) {
                toast.error(t('projectRenameFailed'));
            }
        };

        const handleArchive = async () => {
            const newStatus = project.status === 'archived' ? 'active' : 'archived';
            try {
                await updateProjectMutation.mutateAsync({
                    id: project.id,
                    data: { status: newStatus }
                });
                toast.success(newStatus === 'archived' ? t('projectArchived') : t('projectRestored'));
            } catch (error) {
                toast.error(t('projectStatusFailed'));
            }
        };

        const handleDelete = async () => {
            try {
                await deleteProjectMutation.mutateAsync(project.id);
                toast.success(t('projectDeleted'));
                setDeleteDialogOpen(false);
                onDeleteSuccess?.();
            } catch (error) {
                toast.error(t('projectDeleteFailed'));
            }
        };

        if (!hasAnyAction) return null;

        return (
            <div ref={ref} className={className} {...props}>
                {/* API Keys Drawer */}
                <ApiKeyManagerDrawer
                    open={apiKeysOpen}
                    onOpenChange={setApiKeysOpen}
                    projectId={project.id}
                />

                {/* Rename Dialog */}
                <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{t('renameProject')}</DialogTitle>
                            <DialogDescription>
                                {t('enterNewName')}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleRename} className="space-y-4 pt-2">
                            <Input
                                value={name}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                                placeholder={t('projectNamePlaceholder')}
                                autoFocus
                                className="capitalize"
                            />
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setRenameDialogOpen(false)}
                                >
                                    {tc('cancel')}
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={!name || name === project.name || updateProjectMutation.isPending}
                                    className="bg-accent-blue hover:bg-accent-blue/90"
                                >
                                    {updateProjectMutation.isPending && (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    )}
                                    {t('saveChanges')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation */}
                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t('deleteConfirmTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t('deleteConfirmDescription', { name: project.name })}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={(e: React.MouseEvent) => {
                                    e.preventDefault();
                                    handleDelete();
                                }}
                                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                disabled={deleteProjectMutation.isPending}
                            >
                                {deleteProjectMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <Trash2 className="h-4 w-4 mr-2" />
                                )}
                                {t('deleteProject')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={triggerClassName || "h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"}
                        >
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">{t('openMenu')}</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>{tc('actions')}</DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        {canEditProject && (
                            <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={(e: React.MouseEvent) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setRenameDialogOpen(true);
                                }}
                            >
                                <Pencil className="h-4 w-4 mr-2" />
                                {t('editName')}
                            </DropdownMenuItem>
                        )}

                        {canManageKeys && (
                            <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={(e: React.MouseEvent) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setApiKeysOpen(true);
                                }}
                            >
                                <KeyIcon className="h-4 w-4 mr-2" />
                                {t('apiKeys')}
                            </DropdownMenuItem>
                        )}

                        {canEditProject && (
                            <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={(e: React.MouseEvent) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    router.push(`/projects/${project.id}/settings`);
                                }}
                            >
                                <Settings className="h-4 w-4 mr-2" />
                                {tc('settings')}
                            </DropdownMenuItem>
                        )}

                        {canEditProject && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="cursor-pointer"
                                    disabled={updateProjectMutation.isPending}
                                    onClick={(e: React.MouseEvent) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleArchive();
                                    }}
                                >
                                    <div className="flex items-center w-full">
                                        {updateProjectMutation.isPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : project.status === 'archived' ? (
                                            <div className="h-4 w-4 mr-2 flex items-center justify-center">
                                                <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                                            </div>
                                        ) : (
                                            <div className="h-4 w-4 mr-2 flex items-center justify-center">
                                                <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
                                            </div>
                                        )}
                                        {project.status === 'archived' ? t('restoreProject') : t('archiveProject')}
                                    </div>
                                </DropdownMenuItem>
                            </>
                        )}

                        {canDeleteProject && (
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive cursor-pointer"
                                onClick={(e: React.MouseEvent) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDeleteDialogOpen(true);
                                }}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {tc('delete')}
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        );
    }
);

ProjectActionsMenu.displayName = 'ProjectActionsMenu';
