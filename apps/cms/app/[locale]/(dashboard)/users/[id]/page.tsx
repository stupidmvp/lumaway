'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useUserProfile } from '@luma/infra';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { MainContent } from '@/components/shared/MainContent';
import { useTranslations } from 'next-intl';
import {
    Mail,
    Building2,
    Shield,
    Calendar,
    FolderKanban,
    Loader2,
    UserX,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { data: profile, isLoading, isError } = useUserProfile(id);
    const t = useTranslations('UserProfile');
    const tm = useTranslations('Members');
    const router = useRouter();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-foreground-muted" />
            </div>
        );
    }

    if (isError || !profile) {
        return (
            <div className="flex flex-col h-full bg-background transition-colors duration-300">
                <header className="h-12 bg-background border-b border-border flex justify-between items-center px-2 sm:px-3 shadow-sm z-20 shrink-0 sticky top-0">
                    <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                        <Breadcrumb />
                    </div>
                </header>
                <div className="flex flex-col items-center justify-center flex-1 gap-3">
                    <UserX className="h-12 w-12 text-foreground-muted/30" />
                    <p className="text-sm text-foreground-muted">{t('userNotFound')}</p>
                </div>
            </div>
        );
    }

    const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || t('unknownUser');
    const memberSince = profile.createdAt
        ? new Date(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
        : null;

    const roleLabels: Record<string, string> = {
        owner: tm('owner'),
        editor: tm('editor'),
        viewer: tm('viewer'),
        admin: tm('admin'),
    };

    return (
        <div className="flex flex-col h-full bg-background transition-colors duration-300">
            {/* Header — standard design system pattern */}
            <header className="h-12 bg-background border-b border-border flex justify-between items-center px-2 sm:px-3 shadow-sm z-20 shrink-0 sticky top-0">
                <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                    <Breadcrumb />
                </div>
            </header>

            <MainContent maxWidth="max-w-2xl">
                <div className="space-y-8">
                    {/* Profile hero */}
                    <div className="flex items-start gap-5">
                        <UserAvatar
                            firstName={profile.firstName}
                            lastName={profile.lastName}
                            avatar={profile.avatar}
                            size="xl"
                            className="h-20 w-20 text-lg"
                        />
                        <div className="flex flex-col gap-1 min-w-0 pt-1">
                            <h1 className="text-xl font-bold text-foreground truncate">{fullName}</h1>
                            {profile.email && (
                                <div className="flex items-center gap-1.5 text-sm text-foreground-muted">
                                    <Mail className="h-3.5 w-3.5 shrink-0 opacity-60" />
                                    <span className="truncate">{profile.email}</span>
                                </div>
                            )}
                            {profile.status && (
                                <span className={cn(
                                    "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider w-fit mt-1",
                                    profile.status === 'active' && "bg-accent-green/10 text-accent-green",
                                    profile.status === 'inactive' && "bg-foreground-muted/10 text-foreground-muted",
                                    profile.status === 'suspended' && "bg-destructive/10 text-destructive",
                                )}>
                                    {profile.status}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Info sections */}
                    <div className="space-y-6">
                        {/* Details section */}
                        <section>
                            <h2 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-3">
                                {t('details')}
                            </h2>
                            <div className="space-y-3">
                                {profile.organization && (
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-foreground/[0.04]">
                                            <Building2 className="h-4 w-4 text-foreground-muted" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[11px] text-foreground-muted">{t('organization')}</p>
                                            <p className="text-sm font-medium text-foreground truncate">{profile.organization}</p>
                                        </div>
                                    </div>
                                )}

                                {profile.organizationRole && (
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-foreground/[0.04]">
                                            <Shield className="h-4 w-4 text-foreground-muted" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[11px] text-foreground-muted">{t('organizationRole')}</p>
                                            <p className="text-sm font-medium text-foreground capitalize">
                                                {roleLabels[profile.organizationRole] || profile.organizationRole}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {memberSince && (
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-foreground/[0.04]">
                                            <Calendar className="h-4 w-4 text-foreground-muted" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[11px] text-foreground-muted">{t('memberSince')}</p>
                                            <p className="text-sm font-medium text-foreground">{memberSince}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Shared projects */}
                        {profile.sharedProjects && profile.sharedProjects.length > 0 && (
                            <section>
                                <h2 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-3">
                                    {t('sharedProjects')}
                                </h2>
                                <div className="space-y-1.5">
                                    {profile.sharedProjects.map((project) => (
                                        <button
                                            key={project.id}
                                            onClick={() => router.push(`/projects/${project.id}`)}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-foreground/[0.04] transition-colors text-left cursor-pointer group"
                                        >
                                            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-accent-blue/8 group-hover:bg-accent-blue/12 transition-colors">
                                                <FolderKanban className="h-4 w-4 text-accent-blue" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
                                                <p className="text-[11px] text-foreground-muted capitalize">
                                                    {roleLabels[project.role] || project.role}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            </MainContent>
        </div>
    );
}
