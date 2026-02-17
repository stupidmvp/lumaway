'use client';

import Link from 'next/link';
import Image from 'next/image';
import { FolderKanban, GitPullRequest, Calendar, Users, Star } from 'lucide-react';
import { ProjectActionsMenu } from '@/components/shared/ProjectActionsMenu';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useTranslations } from 'next-intl';
import { useProjectFavorites, useToggleProjectFavorite } from '@luma/infra';
import { cn } from '@/lib/utils';
import { ENV } from '@/lib/env';

const MAX_VISIBLE_MEMBERS = 3;

interface ProjectCardProps {
    project: {
        id: string;
        name: string;
        logo?: string | null;
        isFavorite?: boolean;
        owner?: {
            avatar?: string;
            firstName?: string;
            lastName?: string;
            email?: string;
        };
        members?: {
            id: string;
            firstName?: string;
            lastName?: string;
            email?: string;
            avatar?: string;
        }[];
        membersCount?: number;
        walkthroughsCount?: number;
        status?: 'active' | 'archived';
        createdAt: string;
    };
}

export function ProjectCard({ project }: ProjectCardProps) {
    const tc = useTranslations('Common');
    const t = useTranslations('ProjectCard');

    const { data: favoritesData } = useProjectFavorites();
    const toggleFavorite = useToggleProjectFavorite();

    const favorites = Array.isArray(favoritesData) ? favoritesData : (favoritesData as any)?.data || [];
    const favoriteEntry = favorites.find((f: any) => f.projectId === project.id);
    const isFavorite = project.isFavorite || !!favoriteEntry;

    const handleToggleFavorite = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite.mutate({
            projectId: project.id,
            favoriteId: favoriteEntry?.id,
        });
    };

    const members = project.members || [];
    const totalMembers = project.membersCount || members.length;
    const visibleMembers = members.slice(0, MAX_VISIBLE_MEMBERS);
    const extraCount = totalMembers - MAX_VISIBLE_MEMBERS;

    return (
        <div
            className="group relative flex flex-col p-6 w-full h-[230px] rounded-2xl border border-border/40 bg-background hover:bg-background-secondary/40 hover:border-accent-blue/30 hover:shadow-2xl hover:shadow-accent-blue/5 transition-all duration-300 overflow-hidden"
        >
            <Link href={`/projects/${project.id}`} className="absolute inset-0 z-0" />

            {/* Header Section */}
            <div className="relative z-10 flex items-start justify-between mb-4 pointer-events-none">
                <div className="h-12 w-12 rounded-xl bg-accent-blue/10 text-accent-blue flex items-center justify-center group-hover:bg-accent-blue group-hover:text-white transition-all duration-300 border border-accent-blue/20 overflow-hidden">
                    {project.logo ? (
                        <Image
                            src={project.logo.startsWith('http') ? project.logo : `${ENV.S3_URL_BASE}${project.logo}`}
                            alt={project.name}
                            width={48}
                            height={48}
                            className="h-full w-full object-contain p-1"
                            unoptimized
                        />
                    ) : (
                        <FolderKanban className="h-6 w-6" />
                    )}
                </div>
                <div className="pointer-events-auto flex items-center gap-1">
                    <button
                        onClick={handleToggleFavorite}
                        disabled={toggleFavorite.isPending}
                        className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200",
                            isFavorite
                                ? "text-amber-400 hover:text-amber-500"
                                : "text-foreground-subtle hover:text-amber-400 opacity-0 group-hover:opacity-100"
                        )}
                        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                        <Star className={cn("h-4 w-4", isFavorite && "fill-current")} />
                    </button>
                    <ProjectActionsMenu project={project} />
                </div>
            </div>

            <div className="relative z-10 flex-1 min-w-0 pointer-events-none">
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-foreground group-hover:text-accent-blue transition-colors truncate capitalize" title={project.name}>
                        {project.name}
                    </h3>
                    <div className="flex items-center gap-1.5 ml-1">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${project.status === 'active' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
                            }`} />
                        <span className={`text-[10px] font-bold tracking-wider uppercase ${project.status === 'active' ? 'text-green-500' : 'text-red-500'
                            }`}>
                            {project.status === 'active' ? tc('active') : tc('archived')}
                        </span>
                    </div>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                    {/* Members Avatars */}
                    {visibleMembers.length > 0 ? (
                        <div className="flex items-center gap-1.5 pointer-events-auto">
                            <div className="flex items-center -space-x-1.5">
                                {visibleMembers.map((member) => (
                                    <UserAvatar
                                        key={member.id}
                                        firstName={member.firstName}
                                        lastName={member.lastName}
                                        avatar={member.avatar}
                                        size="xs"
                                        className="ring-2 ring-background"
                                        userInfo={{ email: member.email }}
                                    />
                                ))}
                                {extraCount > 0 && (
                                    <span className="flex items-center justify-center h-4 w-4 rounded-full bg-background-tertiary border border-border text-[8px] font-bold text-foreground-muted ring-2 ring-background">
                                        +{extraCount}
                                    </span>
                                )}
                            </div>
                            <span className="text-[11px] text-foreground-muted ml-1">
                                {totalMembers} {totalMembers === 1 ? 'member' : 'members'}
                            </span>
                        </div>
                    ) : project.owner ? (
                        <div className="flex items-center gap-2 pointer-events-auto">
                            <UserAvatar
                                firstName={project.owner.firstName}
                                lastName={project.owner.lastName}
                                avatar={project.owner.avatar}
                                size="xs"
                                userInfo={{ email: project.owner.email }}
                            />
                            <span className="text-xs text-foreground-muted truncate">
                                {project.owner.firstName} {project.owner.lastName}
                            </span>
                        </div>
                    ) : null}

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-xs text-foreground-subtle">
                            <GitPullRequest className="h-3 w-3" />
                            <span>{t('walkthroughsCount', { count: project.walkthroughsCount || 0 })}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-foreground-subtle">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
