'use client';

import { useState, useEffect, useRef } from 'react';
import { useUpdateProject, usePermissions, useProjectFavorites, useToggleProjectFavorite, type Project } from '@luma/infra';
import { toast } from "sonner";
import { Pencil, UserPen, ShieldCheck, PenLine, Eye, Star, FolderKanban } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/user-avatar';
import { ENV } from '@/lib/env';
import Image from 'next/image';

const ROLE_ICONS: Record<string, React.ElementType> = {
    owner: UserPen,
    admin: ShieldCheck,
    editor: PenLine,
    viewer: Eye,
};

interface MemberPreview {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatar?: string;
}

interface ProjectTitleProps {
    projectId: string;
    organizationId?: string;
    initialTitle: string;
    logo?: string | null;
    status?: 'active' | 'archived';
    owner?: Project['owner'];
    createdAt?: string;
    members?: MemberPreview[];
    membersCount?: number;
}

const MAX_VISIBLE_MEMBERS = 3;

export function ProjectTitle({ projectId, organizationId, initialTitle, logo, status, owner, createdAt, members = [], membersCount }: ProjectTitleProps) {
    const [title, setTitle] = useState(initialTitle);
    const updateProjectMutation = useUpdateProject();
    const permissions = usePermissions();
    const tc = useTranslations('Common');
    const ta = useTranslations('ProjectActions');
    const tm = useTranslations('Members');
    const td = useTranslations('ProjectDetail');
    const inputRef = useRef<HTMLInputElement>(null);

    // Favorites
    const { data: favoritesData } = useProjectFavorites();
    const toggleFavorite = useToggleProjectFavorite();
    const favorites = Array.isArray(favoritesData) ? favoritesData : (favoritesData as any)?.data || [];
    const favoriteEntry = favorites.find((f: any) => f.projectId === projectId);
    const isFavorite = !!favoriteEntry;

    const handleToggleFavorite = () => {
        toggleFavorite.mutate({
            projectId,
            favoriteId: favoriteEntry?.id,
        });
    };

    const canEdit = permissions.can('update', 'projects', { projectId, organizationId });

    // Determine effective role for display
    const directRole = permissions.getProjectRole(projectId);
    const isOrgAdmin = organizationId ? permissions.isOrgAdminOrOwner(organizationId) : false;
    const isSuperAdmin = permissions.isSuperAdmin();
    const effectiveRole = isSuperAdmin ? 'owner' : (directRole ?? (isOrgAdmin ? 'admin' : null));

    useEffect(() => {
        setTitle(initialTitle);
    }, [initialTitle]);



    const handleTitleBlur = () => {
        if (title !== initialTitle) {
            updateProjectMutation.mutate({
                id: projectId,
                data: { name: title }
            }, {
                onSuccess: () => toast.success(ta('projectRenamed')),
                onError: () => {
                    toast.error(ta('projectRenameFailed'));
                    setTitle(initialTitle);
                }
            });
        }
    };

    const ownerName = owner
        ? [owner.firstName, owner.lastName].filter(Boolean).join(' ') || owner.email
        : null;

    const formattedDate = createdAt
        ? new Date(createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
        : null;

    const logoFullUrl = logo
        ? logo.startsWith('http') ? logo : `${ENV.S3_URL_BASE}${logo}`
        : null;

    return (
        <div className="mb-5">
            {/* Row 0: Logo + Title block */}
            <div className="flex items-start gap-3">
                {/* Project logo */}
                <div className="h-12 w-12 rounded-xl bg-accent-blue/10 text-accent-blue flex items-center justify-center border border-accent-blue/20 overflow-hidden shrink-0">
                    {logoFullUrl ? (
                        <Image
                            src={logoFullUrl}
                            alt={initialTitle}
                            width={48}
                            height={48}
                            className="h-full w-full object-contain p-1"
                            unoptimized
                        />
                    ) : (
                        <FolderKanban className="h-6 w-6" />
                    )}
                </div>

                <div className="flex-1 min-w-0">
            {/* Row 1: Badges */}
            <div className="flex items-center gap-2 mb-1">
                {/* Status badge */}
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-background-secondary/50 border border-border/50">
                    <span className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        status === 'active'
                            ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]'
                            : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]'
                    )} />
                    <span className="text-[9px] font-semibold tracking-wider uppercase text-foreground-muted">
                        {status === 'active' ? tc('active') : tc('archived')}
                    </span>
                </div>

                {/* Role badge */}
                {effectiveRole && (() => {
                    const RoleIcon = ROLE_ICONS[effectiveRole];
                    const roleLabel = effectiveRole === 'owner' ? tc('author') : tm(effectiveRole);
                    return (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-blue/10 border border-accent-blue/20">
                            {RoleIcon && <RoleIcon className="h-2.5 w-2.5 text-accent-blue" />}
                            <span className="text-[9px] font-semibold tracking-wider uppercase text-accent-blue">
                                {roleLabel}
                            </span>
                        </div>
                    );
                })()}

                {/* Members preview */}
                {members.length > 0 && (() => {
                    const totalMembers = membersCount || members.length;
                    const visibleMembers = members.slice(0, MAX_VISIBLE_MEMBERS);
                    const extraCount = totalMembers - MAX_VISIBLE_MEMBERS;
                    return (
                        <div className="flex items-center gap-1.5 ml-1">
                            <div className="flex items-center -space-x-1.5">
                                {visibleMembers.map((member) => (
                                    <UserAvatar
                                        key={member.id}
                                        firstName={member.firstName}
                                        lastName={member.lastName}
                                        avatar={member.avatar}
                                        size="xs"
                                        className="ring-2 ring-background-secondary dark:ring-background"
                                        userInfo={{ email: member.email }}
                                    />
                                ))}
                                {extraCount > 0 && (
                                    <span className="flex items-center justify-center h-4 w-4 rounded-full bg-background-tertiary border border-border text-[8px] font-bold text-foreground-muted ring-2 ring-background-secondary dark:ring-background">
                                        +{extraCount}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* Row 2: Editable title + favorite star */}
            <div className="flex-1 min-w-0 group mb-1.5">
                <div className="flex items-center gap-2 w-full">
                    <input
                        ref={inputRef}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={handleTitleBlur}
                        readOnly={!canEdit}
                        className={cn(
                            "flex-1 min-w-0 text-xl sm:text-2xl font-bold bg-transparent border-none outline-none focus:outline-none focus:ring-0 px-0 shadow-none placeholder:text-foreground-muted/50 text-foreground transition-none capitalize",
                            canEdit ? "cursor-text" : "cursor-default"
                        )}
                        placeholder={ta('projectNamePlaceholder')}
                    />
                    {canEdit && (
                        <Pencil className="h-3.5 w-3.5 shrink-0 text-foreground-muted/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
                    )}
                    <button
                        onClick={handleToggleFavorite}
                        disabled={toggleFavorite.isPending}
                        className={cn(
                            "shrink-0 h-7 w-7 rounded-md flex items-center justify-center transition-all duration-200 cursor-pointer",
                            isFavorite
                                ? "text-amber-400 hover:text-amber-500"
                                : "text-foreground-subtle/40 hover:text-amber-400"
                        )}
                        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                        <Star className={cn("h-4.5 w-4.5", isFavorite && "fill-current")} />
                    </button>
                </div>
            </div>

            {/* Row 3: Meta info — author & date */}
            {(ownerName || formattedDate) && (
                <div className="flex items-center gap-1.5 text-[11px] text-foreground-muted">
                    {owner && (
                        <UserAvatar
                            firstName={owner.firstName}
                            lastName={owner.lastName}
                            avatar={owner.avatar}
                            size="xs"
                            className="h-4 w-4"
                            userInfo={{ email: owner.email }}
                        />
                    )}
                    <span className="truncate">
                        {ownerName && td('createdBy', { name: ownerName })}
                        {ownerName && formattedDate && ' · '}
                        {formattedDate}
                    </span>
                </div>
            )}
                </div>{/* end flex-1 */}
            </div>{/* end logo + title block */}
        </div>
    );
}
