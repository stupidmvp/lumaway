'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    useInvitationByToken,
    useAcceptInvitation,
    useRejectInvitation,
    AuthService,
} from '@luma/infra';
import { Button } from '@/components/ui/button';
import { Loader2, UserPlus, X, FolderKanban, Crown, Pencil, Eye, CheckCircle, XCircle, AlertTriangle, LogIn, UserRoundPlus } from 'lucide-react';
import { UserAvatar } from '@/components/ui/user-avatar';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';

const ROLE_ICONS: Record<string, React.ElementType> = {
    owner: Crown,
    editor: Pencil,
    viewer: Eye,
};

export default function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);
    const router = useRouter();
    const t = useTranslations('Invitation');

    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    // Check auth state on mount
    useEffect(() => {
        const authToken = AuthService.getToken();
        setIsAuthenticated(!!authToken);
    }, []);

    const { data: invitation, isLoading, isError, error } = useInvitationByToken(token);
    const acceptMutation = useAcceptInvitation();
    const rejectMutation = useRejectInvitation();
    const [handled, setHandled] = useState<'accepted' | 'rejected' | null>(null);

    const handleAccept = async () => {
        try {
            const result = await acceptMutation.mutateAsync(token);
            setHandled('accepted');
            toast.success(t('accepted'));

            // Pre-select the invitation's organization so the dashboard opens in the right context
            if (result.organizationId) {
                localStorage.setItem('lumaway_active_org', result.organizationId);
            }

            setTimeout(() => {
                router.push(`/projects/${result.projectId}`);
            }, 1500);
        } catch (error: any) {
            const message = error?.response?.data?.error || error?.message || 'Error';
            toast.error(message);
        }
    };

    const handleReject = async () => {
        try {
            await rejectMutation.mutateAsync(token);
            setHandled('rejected');
            toast.success(t('rejected'));
            setTimeout(() => {
                router.push('/projects');
            }, 1500);
        } catch (error: any) {
            toast.error(error?.response?.data?.error || error?.message || 'Error');
        }
    };

    // Loading state
    if (isLoading || isAuthenticated === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-brand-black bg-[radial-gradient(circle_at_50%_30%,#1E1E2E_0%,#12121A_60%,#0B0B0F_100%)]">
                <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
            </div>
        );
    }

    // Error state
    if (isError) {
        const errorMessage = (error as any)?.response?.data?.error || t('notFound');
        const errorStatus = (error as any)?.response?.data?.status;

        return (
            <div className="min-h-screen flex items-center justify-center bg-brand-black bg-[radial-gradient(circle_at_50%_30%,#1E1E2E_0%,#12121A_60%,#0B0B0F_100%)]">
                <div className="max-w-md w-full text-center px-6">
                    <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
                        <AlertTriangle className="h-8 w-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-semibold text-white mb-2">
                        {errorStatus === 'expired' ? t('expired') : t('notFound')}
                    </h2>
                    <p className="text-sm text-gray-400 mb-6">{errorMessage}</p>
                    <Button variant="outline" onClick={() => router.push('/login')} className="border-gray-700 text-gray-300 hover:bg-gray-800">
                        {t('loginToAccept')}
                    </Button>
                </div>
            </div>
        );
    }

    if (!invitation) return null;

    const inviterName = invitation.inviter
        ? [invitation.inviter.firstName, invitation.inviter.lastName].filter(Boolean).join(' ') || invitation.inviter.email
        : 'Someone';

    const RoleIcon = ROLE_ICONS[invitation.role] || Eye;

    // Success state after accept/reject
    if (handled) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-brand-black bg-[radial-gradient(circle_at_50%_30%,#1E1E2E_0%,#12121A_60%,#0B0B0F_100%)]">
                <div className="max-w-md w-full text-center px-6">
                    <div className={`mx-auto mb-6 h-16 w-16 rounded-2xl flex items-center justify-center ${handled === 'accepted' ? 'bg-green-500/10' : 'bg-gray-500/10'
                        }`}>
                        {handled === 'accepted' ? (
                            <CheckCircle className="h-8 w-8 text-green-500" />
                        ) : (
                            <XCircle className="h-8 w-8 text-gray-400" />
                        )}
                    </div>
                    <h2 className="text-xl font-semibold text-white mb-2">
                        {handled === 'accepted' ? t('accepted') : t('rejected')}
                    </h2>
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Redirecting...
                    </div>
                </div>
            </div>
        );
    }

    // Invitation card content (shared between auth states)
    const InvitationDetails = () => (
        <>
            {/* Icon */}
            <div className="mx-auto mb-6 h-14 w-14 rounded-2xl bg-accent-blue/10 flex items-center justify-center">
                <UserPlus className="h-7 w-7 text-accent-blue" />
            </div>

            {/* Title */}
            <h1 className="text-xl font-semibold text-white text-center mb-2">
                {t('title')}
            </h1>

            {/* Project info */}
            <div className="flex items-center justify-center gap-2 mb-6">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                    <FolderKanban className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-white">
                        {invitation.project?.name || 'Unknown Project'}
                    </span>
                </div>
            </div>

            {/* Inviter */}
            <div className="flex items-center justify-center gap-2 mb-2">
                {invitation.inviter && (
                    <UserAvatar
                        firstName={invitation.inviter.firstName}
                        lastName={invitation.inviter.lastName}
                        avatar={invitation.inviter.avatar}
                        size="xs"
                        className="h-5 w-5"
                        userInfo={{ email: invitation.inviter.email }}
                    />
                )}
                <span className="text-sm text-gray-400">
                    {t('description', { inviter: inviterName })}
                </span>
            </div>

            {/* Role */}
            <div className="flex items-center justify-center gap-1.5 mb-8">
                <RoleIcon className="h-3.5 w-3.5 text-accent-blue" />
                <span className="text-sm font-medium text-accent-blue">
                    {t('asRole', { role: invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1) })}
                </span>
            </div>
        </>
    );

    return (
        <div className="min-h-screen flex items-center justify-center bg-brand-black bg-[radial-gradient(circle_at_50%_30%,#1E1E2E_0%,#12121A_60%,#0B0B0F_100%)] px-4">
            <div className="max-w-md w-full">
                {/* Logo */}
                <div className="flex justify-center mb-8">
                    <div className="w-20 h-20 relative flex items-center justify-center">
                        <Image
                            src="/luma.png"
                            alt="LumaWay"
                            width={80}
                            height={80}
                            className="object-contain drop-shadow-[0_0_25px_rgba(167,216,255,0.6)]"
                            priority
                        />
                    </div>
                </div>

                {/* Card */}
                <div className="bg-[#1a1a2e]/80 backdrop-blur-sm border border-white/10 rounded-xl p-8 shadow-2xl">
                    <InvitationDetails />

                    {isAuthenticated ? (
                        /* Authenticated — show accept/reject */
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1 gap-2 border-gray-700 text-gray-300 hover:bg-gray-800"
                                onClick={handleReject}
                                disabled={rejectMutation.isPending || acceptMutation.isPending}
                            >
                                {rejectMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <X className="h-4 w-4" />
                                )}
                                {rejectMutation.isPending ? t('rejecting') : t('reject')}
                            </Button>

                            <Button
                                className="flex-1 gap-2 bg-accent-blue hover:bg-accent-blue/90 text-white"
                                onClick={handleAccept}
                                disabled={acceptMutation.isPending || rejectMutation.isPending}
                            >
                                {acceptMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <CheckCircle className="h-4 w-4" />
                                )}
                                {acceptMutation.isPending ? t('accepting') : t('accept')}
                            </Button>
                        </div>
                    ) : (
                        /* Not authenticated — show login/register options */
                        <div className="space-y-3">
                            <p className="text-sm text-center text-gray-400 mb-4">
                                {t('loginRequired')}
                            </p>
                            <Link href={`/login?redirect=/invite/${token}`} className="block">
                                <Button className="w-full gap-2 bg-accent-blue hover:bg-accent-blue/90 text-white">
                                    <LogIn className="h-4 w-4" />
                                    {t('loginToAccept')}
                                </Button>
                            </Link>
                            <Link href={`/register?redirect=/invite/${token}`} className="block">
                                <Button
                                    variant="outline"
                                    className="w-full gap-2 border-gray-700 text-gray-300 hover:bg-gray-800"
                                >
                                    <UserRoundPlus className="h-4 w-4" />
                                    {t('createAccount')}
                                </Button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

