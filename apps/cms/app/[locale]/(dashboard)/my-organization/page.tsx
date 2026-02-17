'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    useMyOrganization,
    useUpdateOrganization,
    useOrganizationMembers,
    useUpdateOrganizationMemberRole,
    useRemoveOrganizationMember,
    useCurrentUser,
    usePermissions,
    OrganizationMember,
} from '@luma/infra';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileUpload, FileWithProgress } from '@/components/ui/file-upload';
import { SearchInput } from '@/components/ui/search-input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
import { FilterButton } from '@/components/shared/FilterButton';
import {
    Loader2,
    Save,
    Building2,
    ImageIcon,
    Users,
    Crown,
    ShieldCheck,
    UserIcon,
    Trash2,
    Search,
} from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { ENV } from '@/lib/env';
import { MainContent } from '@/components/shared/MainContent';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useTranslations } from 'next-intl';

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

const ROLE_BG: Record<string, string> = {
    owner: 'bg-amber-500/10',
    admin: 'bg-accent-blue/10',
    member: 'bg-foreground-muted/10',
};

export default function MyOrganizationPage() {
    const { data: organization, isLoading } = useMyOrganization();
    const { data: currentUser } = useCurrentUser();
    const updateOrganization = useUpdateOrganization();
    const t = useTranslations('Organization');
    const tc = useTranslations('Common');

    const [orgName, setOrgName] = useState('');
    const [orgSlug, setOrgSlug] = useState('');
    const [orgLogo, setOrgLogo] = useState<string | null>(null);
    const [hasChanges, setHasChanges] = useState(false);

    // Members state
    const { data: membersData, isLoading: membersLoading } = useOrganizationMembers(organization?.id);
    const updateMemberRole = useUpdateOrganizationMemberRole();
    const removeMember = useRemoveOrganizationMember();

    const [memberSearch, setMemberSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [memberToRemove, setMemberToRemove] = useState<OrganizationMember | null>(null);

    const { can } = usePermissions();
    const members: OrganizationMember[] = membersData?.data || [];
    const orgCtx = organization ? { organizationId: organization.id } : {};
    const canManageOrg = organization ? can('manage', 'organizations', orgCtx) : false;
    const canManageMembers = organization ? can('manage', 'organization_members', orgCtx) : false;
    const canUpdateOrg = organization ? can('update', 'organizations', orgCtx) : false;
    // isOwner gates destructive member actions (role change to owner, remove)
    const isOwner = canManageOrg;

    // Filtered members
    const displayedMembers = useMemo(() => {
        let list = members;
        if (roleFilter && roleFilter !== 'all') {
            list = list.filter(m => m.role === roleFilter);
        }
        if (memberSearch.trim()) {
            const q = memberSearch.trim().toLowerCase();
            list = list.filter(m => {
                const name = [m.firstName, m.lastName].filter(Boolean).join(' ').toLowerCase();
                const email = (m.email || '').toLowerCase();
                return name.includes(q) || email.includes(q);
            });
        }
        return list;
    }, [members, roleFilter, memberSearch]);

    useEffect(() => {
        if (organization) {
            setOrgName(organization.name || '');
            setOrgSlug(organization.slug || '');
            setOrgLogo(organization.logo || null);
        }
    }, [organization]);

    useEffect(() => {
        if (!organization) return;
        const changed =
            orgName !== (organization.name || '') ||
            orgSlug !== (organization.slug || '') ||
            orgLogo !== (organization.logo || null);
        setHasChanges(changed);
    }, [orgName, orgSlug, orgLogo, organization]);

    const handleLogoUpload = (files: FileWithProgress[]) => {
        const file = files[0];
        if (file?.fileUrl) {
            setOrgLogo(file.fileUrl);
        }
    };

    const handleSave = async () => {
        try {
            await updateOrganization.mutateAsync({
                name: orgName,
                slug: orgSlug,
                logo: orgLogo,
            });
            toast.success(t('organizationUpdated'));
        } catch (error) {
            console.error('Error updating organization:', error);
            toast.error(t('organizationUpdateFailed'));
        }
    };

    const handleRoleChange = async (memberId: string, newRole: string) => {
        try {
            await updateMemberRole.mutateAsync({ memberId, role: newRole });
            toast.success(t('roleUpdated'));
        } catch {
            toast.error(t('roleUpdateFailed'));
        }
    };

    const handleRemoveMember = async () => {
        if (!memberToRemove) return;
        try {
            await removeMember.mutateAsync(memberToRemove.id);
            toast.success(t('memberRemoved'));
        } catch {
            toast.error(t('memberRemoveFailed'));
        } finally {
            setMemberToRemove(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
            </div>
        );
    }

    if (!organization) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center justify-center gap-2 text-foreground-muted">
                    <Building2 className="h-8 w-8" />
                    <p className="text-sm">{t('noOrganization')}</p>
                </div>
            </div>
        );
    }

    const logoFullUrl = orgLogo
        ? orgLogo.startsWith('http') ? orgLogo : `${ENV.S3_URL_BASE}${orgLogo}`
        : null;

    return (
        <div className="flex flex-col h-full bg-background transition-colors duration-300">
            <header className="h-14 bg-background border-b border-border flex justify-between items-center px-4 shadow-sm z-20 shrink-0 sticky top-0">
                <div className="flex items-center gap-4">
                    <h1 className="text-lg font-semibold text-foreground">{t('title')}</h1>
                </div>
                {canUpdateOrg && (
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={handleSave}
                            disabled={!hasChanges || updateOrganization.isPending}
                            className="h-9 px-4 gap-2 bg-accent-blue hover:bg-accent-blue/90 text-white shadow-sm cursor-pointer"
                        >
                            {updateOrganization.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            <span className="text-sm font-medium">
                                {updateOrganization.isPending ? tc('saving') : tc('save')}
                            </span>
                        </Button>
                    </div>
                )}
            </header>

            <MainContent maxWidth="max-w-3xl">
                <div className="space-y-6">
                    {/* Organization Logo */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">{t('logoTitle')}</CardTitle>
                            <CardDescription>
                                {t('logoDescription')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-5">
                                <FileUpload
                                    s3Type="logo"
                                    uploadPath={`organizations/${organization.id}`}
                                    allowedTypes={['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']}
                                    maxSize={5242880}
                                    multiple={false}
                                    showDropzone={false}
                                    showFiles={false}
                                    showInfo={false}
                                    showPlaceholder={false}
                                    className="w-auto"
                                    contentClassName="justify-start"
                                    onUploadSuccess={handleLogoUpload}
                                    onUploadError={(error) => {
                                        console.error('Logo upload error:', error);
                                        toast.error(t('logoUploadFailed'));
                                    }}
                                >
                                    <div className="relative group cursor-pointer">
                                        <div className="h-20 w-20 rounded-xl bg-background-tertiary border border-border flex items-center justify-center overflow-hidden transition-opacity group-hover:opacity-80">
                                            {logoFullUrl ? (
                                                <Image
                                                    src={logoFullUrl}
                                                    alt={orgName || t('organizationLogo')}
                                                    width={80}
                                                    height={80}
                                                    className="h-full w-full object-contain p-1"
                                                    unoptimized={!logoFullUrl.startsWith('https://ik.imagekit.io')}
                                                />
                                            ) : (
                                                <Building2 className="h-8 w-8 text-foreground-muted" />
                                            )}
                                        </div>
                                        <div className="absolute inset-0 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-0.5">
                                            <ImageIcon className="h-4 w-4 text-white" />
                                            <span className="text-[10px] font-medium text-white">{tc('change')}</span>
                                        </div>
                                    </div>
                                </FileUpload>
                                <div className="flex flex-col gap-1">
                                    <p className="text-sm font-medium text-foreground">
                                        {orgName || t('organizationLogo')}
                                    </p>
                                    <p className="text-xs text-foreground-subtle">
                                        {orgLogo ? t('clickLogoToReplace') : t('clickToUploadLogo')}
                                    </p>
                                    {orgLogo && (
                                        <button
                                            type="button"
                                            className="text-xs text-foreground-muted hover:text-destructive transition-colors text-left mt-1 w-fit"
                                            onClick={() => setOrgLogo(null)}
                                        >
                                            {t('removeLogo')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Organization Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">{t('detailsTitle')}</CardTitle>
                            <CardDescription>
                                {t('detailsDescription')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="orgName">{t('name')}</Label>
                                    <Input
                                        id="orgName"
                                        value={orgName}
                                        onChange={(e) => setOrgName(e.target.value)}
                                        placeholder={t('namePlaceholder')}
                                        disabled={!canUpdateOrg}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="orgSlug">{t('slug')}</Label>
                                    <Input
                                        id="orgSlug"
                                        value={orgSlug}
                                        onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                                        placeholder={t('slugPlaceholder')}
                                        disabled={!canUpdateOrg}
                                    />
                                    <p className="text-xs text-foreground-subtle">
                                        {t('slugHelp')}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Organization Members */}
                    {canManageMembers && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base">{t('membersTitle')}</CardTitle>
                                        <CardDescription>
                                            {t('membersDescription')}
                                        </CardDescription>
                                    </div>
                                    {members.length > 0 && (
                                        <span className="text-xs text-foreground-muted font-medium">
                                            {t('membersCount', { count: members.length })}
                                        </span>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                {membersLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-accent-blue" />
                                    </div>
                                ) : members.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10">
                                        <div className="h-10 w-10 rounded-full bg-foreground-muted/5 flex items-center justify-center mb-3">
                                            <Users className="h-5 w-5 text-foreground-muted/40" />
                                        </div>
                                        <p className="text-sm font-medium text-foreground mb-1">{t('noMembers')}</p>
                                        <p className="text-xs text-foreground-muted text-center max-w-sm">
                                            {t('noMembersDescription')}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {/* Search & filter toolbar */}
                                        {members.length > 3 && (
                                            <div className="flex flex-col sm:flex-row items-center gap-3">
                                                <div className="w-full sm:w-72">
                                                    <SearchInput
                                                        value={memberSearch}
                                                        onChange={(e) => setMemberSearch(e.target.value)}
                                                        onClear={() => setMemberSearch('')}
                                                        placeholder={t('searchMembers')}
                                                        className="h-8 text-[13px] bg-background-secondary/50 border-transparent focus-visible:bg-background focus-visible:border-input"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2 ml-auto">
                                                    <FilterButton
                                                        title={t('filterRole')}
                                                        value={roleFilter}
                                                        onChange={setRoleFilter}
                                                        options={[
                                                            { label: t('roleOwner'), value: 'owner', icon: Crown },
                                                            { label: t('roleAdmin'), value: 'admin', icon: ShieldCheck },
                                                            { label: t('roleMember'), value: 'member', icon: UserIcon },
                                                        ]}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Members list */}
                                        {displayedMembers.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-8">
                                                <Search className="h-6 w-6 text-foreground-muted/30 mb-2" />
                                                <p className="text-sm text-foreground-muted">{t('noSearchResults')}</p>
                                            </div>
                                        ) : (
                                            <div className="rounded-xl border border-border divide-y divide-border">
                                                {displayedMembers.map((member) => {
                                                    const RoleIcon = ROLE_ICONS[member.role] || UserIcon;
                                                    const isCurrentUser = member.userId === currentUser?.id;
                                                    const memberName = [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email || '—';

                                                    return (
                                                        <div
                                                            key={member.id}
                                                            className="flex items-center gap-4 px-4 py-3 group hover:bg-background-secondary/30 transition-colors"
                                                        >
                                                            <UserAvatar
                                                                firstName={member.firstName}
                                                                lastName={member.lastName}
                                                                avatar={member.avatar}
                                                                size="sm"
                                                                userInfo={{
                                                                    email: member.email,
                                                                    role: member.role,
                                                                    organization: organization?.name,
                                                                }}
                                                                triggerMode="hover"
                                                            />

                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-sm font-medium text-foreground truncate">
                                                                        {memberName}
                                                                    </span>
                                                                    {isCurrentUser && (
                                                                        <span className="text-[10px] text-foreground-muted font-medium">({t('you')})</span>
                                                                    )}
                                                                </div>
                                                                <span className="text-xs text-foreground-muted truncate block">
                                                                    {member.email}
                                                                </span>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                {isOwner && !isCurrentUser ? (
                                                                    <Select
                                                                        value={member.role}
                                                                        onValueChange={(newRole) => handleRoleChange(member.id, newRole)}
                                                                    >
                                                                        <SelectTrigger className="h-7 w-auto min-w-[110px] text-xs border-none bg-background-secondary/50 hover:bg-background-secondary">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <RoleIcon className={`h-3 w-3 ${ROLE_COLORS[member.role]}`} />
                                                                                <span>{t(`role${member.role.charAt(0).toUpperCase() + member.role.slice(1)}` as any)}</span>
                                                                            </div>
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="owner">
                                                                                <div className="flex items-center gap-2">
                                                                                    <Crown className="h-3 w-3 text-amber-500" />
                                                                                    <span>{t('roleOwner')}</span>
                                                                                </div>
                                                                            </SelectItem>
                                                                            <SelectItem value="admin">
                                                                                <div className="flex items-center gap-2">
                                                                                    <ShieldCheck className="h-3 w-3 text-accent-blue" />
                                                                                    <span>{t('roleAdmin')}</span>
                                                                                </div>
                                                                            </SelectItem>
                                                                            <SelectItem value="member">
                                                                                <div className="flex items-center gap-2">
                                                                                    <UserIcon className="h-3 w-3 text-foreground-muted" />
                                                                                    <span>{t('roleMember')}</span>
                                                                                </div>
                                                                            </SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                ) : (
                                                                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs ${ROLE_BG[member.role]}`}>
                                                                        <RoleIcon className={`h-3 w-3 ${ROLE_COLORS[member.role]}`} />
                                                                        <span className={ROLE_COLORS[member.role]}>
                                                                            {t(`role${member.role.charAt(0).toUpperCase() + member.role.slice(1)}` as any)}
                                                                        </span>
                                                                    </div>
                                                                )}

                                                                {isOwner && !isCurrentUser && (
                                                                    <button
                                                                        onClick={() => setMemberToRemove(member)}
                                                                        className="p-1.5 rounded-md text-foreground-muted hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                                                        title={t('removeMember')}
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </MainContent>

            {/* Remove Member Confirmation */}
            <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('removeMemberTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('removeMemberDescription', {
                                name: [memberToRemove?.firstName, memberToRemove?.lastName].filter(Boolean).join(' ') || memberToRemove?.email || '',
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRemoveMember}
                            className="bg-red-500 hover:bg-red-600 text-white"
                        >
                            {removeMember.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            {t('removeMember')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
