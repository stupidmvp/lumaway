'use client';

import { useState } from 'react';
import {
    useMyOrganizations,
    useDeleteOrganization,
    useLeaveOrganization,
    useActiveOrganization,
    OrganizationMembership,
} from '@luma/infra';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Loader2,
    Building2,
    Plus,
    Crown,
    ShieldCheck,
    UserIcon,
    MoreHorizontal,
    Settings,
    LogOut,
    Trash2,
    ArrowRightLeft,
    CheckCircle2,
} from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { MainContent } from '@/components/shared/MainContent';
import { CreateOrganizationDialog } from '@/components/shared/CreateOrganizationDialog';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ENV } from '@/lib/env';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const ROLE_ICONS: Record<string, React.ElementType> = {
    owner: Crown,
    admin: ShieldCheck,
    member: UserIcon,
};

const ROLE_COLORS: Record<string, string> = {
    owner: 'text-amber-500',
    admin: 'text-accent-blue',
    member: 'text-foreground-muted',
};

export default function OrganizationsPage() {
    const t = useTranslations('Organization');
    const tc = useTranslations('Common');
    const router = useRouter();

    const { data: orgsData, isLoading } = useMyOrganizations();
    const { activeOrgId, switchOrganization } = useActiveOrganization();
    const deleteOrganization = useDeleteOrganization();
    const leaveOrganization = useLeaveOrganization();

    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [orgToDelete, setOrgToDelete] = useState<OrganizationMembership | null>(null);
    const [orgToLeave, setOrgToLeave] = useState<OrganizationMembership | null>(null);

    const organizations: OrganizationMembership[] = orgsData?.data || [];

    const handleDelete = async () => {
        if (!orgToDelete) return;
        try {
            await deleteOrganization.mutateAsync(orgToDelete.id);
            toast.success(t('organizationDeleted'));
        } catch (error: any) {
            const message = error?.response?.data?.error || t('organizationDeleteFailed');
            toast.error(message);
        } finally {
            setOrgToDelete(null);
        }
    };

    const handleLeave = async () => {
        if (!orgToLeave) return;
        try {
            await leaveOrganization.mutateAsync(orgToLeave.id);
            toast.success(t('organizationLeft'));
        } catch (error: any) {
            const message = error?.response?.data?.error || t('organizationLeaveFailed');
            toast.error(message);
        } finally {
            setOrgToLeave(null);
        }
    };

    const handleSwitch = (orgId: string) => {
        if (orgId !== activeOrgId) {
            switchOrganization(orgId);
            router.push('/projects');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background transition-colors duration-300">
            {/* Toolbar — matches WalkthroughsHeader / ProjectsHeader pattern */}
            <header className="h-14 bg-background border-b border-border flex justify-between items-center px-4 shadow-sm z-20 shrink-0 sticky top-0">
                <div className="flex items-center gap-4">
                    <Breadcrumb />
                </div>

                <Button
                    onClick={() => setCreateDialogOpen(true)}
                    className="h-9 px-4 gap-2 bg-accent-blue hover:bg-accent-blue/90 text-white shadow-sm cursor-pointer"
                >
                    <Plus className="h-4 w-4" />
                    <span className="text-sm font-medium">{t('createOrganization')}</span>
                </Button>
            </header>

            <MainContent maxWidth="max-w-4xl">
                {/* Page Title */}
                <div className="mb-6">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('myOrganizations')}</h1>
                        {organizations.length > 0 && (
                            <span className="text-xs text-foreground-muted font-medium bg-background-secondary px-2 py-0.5 rounded-full">
                                {t('organizationsCount', { count: organizations.length })}
                            </span>
                        )}
                    </div>
                    <p className="text-foreground-muted mt-1 text-sm">{t('myOrganizationsDescription')}</p>
                </div>

                {organizations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="h-16 w-16 rounded-2xl bg-accent-blue/10 flex items-center justify-center mb-4">
                            <Building2 className="h-8 w-8 text-accent-blue" />
                        </div>
                        <h2 className="text-lg font-semibold text-foreground mb-1">{t('noOrganizations')}</h2>
                        <p className="text-sm text-foreground-muted text-center max-w-sm mb-6">
                            {t('noOrganizationsDescription')}
                        </p>
                        <Button
                            onClick={() => setCreateDialogOpen(true)}
                            className="bg-accent-blue hover:bg-accent-blue/90 text-white cursor-pointer"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            {t('createOrganization')}
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {organizations.map((org) => {
                            const isActive = org.id === activeOrgId;
                            const RoleIcon = ROLE_ICONS[org.role] || UserIcon;
                            const logoUrl = org.logo
                                ? org.logo.startsWith('http') ? org.logo : `${ENV.S3_URL_BASE}${org.logo}`
                                : null;

                            return (
                                <Card
                                    key={org.id}
                                    className={cn(
                                        "group transition-all hover:shadow-md",
                                        isActive && "ring-2 ring-accent-blue/30 shadow-sm"
                                    )}
                                >
                                    <CardContent className="flex items-center gap-4 p-4">
                                        {/* Org Logo */}
                                        <div className="h-12 w-12 rounded-xl bg-background-tertiary border border-border flex items-center justify-center overflow-hidden shrink-0">
                                            {logoUrl ? (
                                                <Image
                                                    src={logoUrl}
                                                    alt={org.name}
                                                    width={48}
                                                    height={48}
                                                    className="h-full w-full object-contain p-1"
                                                    unoptimized={!logoUrl.startsWith('https://ik.imagekit.io')}
                                                />
                                            ) : (
                                                <Building2 className="h-5 w-5 text-foreground-muted" />
                                            )}
                                        </div>

                                        {/* Org Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-semibold text-foreground truncate">
                                                    {org.name}
                                                </h3>
                                                {isActive && (
                                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-accent-blue/10 text-accent-blue border-accent-blue/20 shrink-0">
                                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                                        {t('currentOrg')}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-xs text-foreground-muted">/{org.slug}</span>
                                                <div className={cn(
                                                    "flex items-center gap-1 text-xs",
                                                    ROLE_COLORS[org.role]
                                                )}>
                                                    <RoleIcon className="h-3 w-3" />
                                                    <span className="capitalize">{t(`role${org.role.charAt(0).toUpperCase() + org.role.slice(1)}` as any)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            {!isActive && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleSwitch(org.id)}
                                                    className="h-8 text-xs gap-1.5 cursor-pointer"
                                                >
                                                    <ArrowRightLeft className="h-3 w-3" />
                                                    {t('switchTo')}
                                                </Button>
                                            )}

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 cursor-pointer"
                                                    >
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    {(org.role === 'owner' || org.role === 'admin') && (
                                                        <DropdownMenuItem
                                                            onClick={() => {
                                                                if (org.id !== activeOrgId) {
                                                                    switchOrganization(org.id);
                                                                }
                                                                router.push('/my-organization');
                                                            }}
                                                            className="cursor-pointer"
                                                        >
                                                            <Settings className="h-4 w-4 mr-2" />
                                                            {t('manageOrganization')}
                                                        </DropdownMenuItem>
                                                    )}

                                                    {org.role !== 'owner' && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                onClick={() => setOrgToLeave(org)}
                                                                className="text-destructive focus:text-destructive cursor-pointer"
                                                            >
                                                                <LogOut className="h-4 w-4 mr-2" />
                                                                {t('leaveOrganization')}
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}

                                                    {org.role === 'owner' && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                onClick={() => setOrgToDelete(org)}
                                                                className="text-destructive focus:text-destructive cursor-pointer"
                                                            >
                                                                <Trash2 className="h-4 w-4 mr-2" />
                                                                {t('deleteOrganization')}
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </MainContent>

            {/* Create Organization Dialog */}
            <CreateOrganizationDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
            />

            {/* Delete Organization Confirmation */}
            <AlertDialog open={!!orgToDelete} onOpenChange={(open) => !open && setOrgToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteOrganizationTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('deleteOrganizationDescription', { name: orgToDelete?.name || '' })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-red-500 hover:bg-red-600 text-white"
                        >
                            {deleteOrganization.isPending && (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            )}
                            {t('deleteOrganization')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Leave Organization Confirmation */}
            <AlertDialog open={!!orgToLeave} onOpenChange={(open) => !open && setOrgToLeave(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('leaveOrganizationTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('leaveOrganizationDescription', { name: orgToLeave?.name || '' })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleLeave}
                            className="bg-red-500 hover:bg-red-600 text-white"
                        >
                            {leaveOrganization.isPending && (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            )}
                            {t('leaveOrganization')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

