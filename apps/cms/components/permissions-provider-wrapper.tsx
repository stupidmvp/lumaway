'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { PermissionsProvider, ActiveOrganizationProvider, useCurrentUser, AuthService } from '@luma/infra';
import type { User } from '@luma/infra';
import { Loader2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useLocale } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Determines whether a user needs onboarding.
 *
 * A user needs onboarding when ALL of these are true:
 *  - `preferences.onboardingCompleted` is NOT true
 *  - They have NO organizationId (legacy field)
 *  - They have NO organization memberships (from invitations or self-created)
 *
 * This means:
 *  - Existing users who already had an org → skip (legacy users)
 *  - Invited users who accepted an invitation → skip (they get onboardingCompleted auto-set,
 *    AND they get org memberships)
 *  - Truly new, self-registered users with nothing → onboard them
 */
function userNeedsOnboarding(user: User | null | undefined): boolean {
    if (!user) return false;
    const isOnboarded = user.preferences?.onboardingCompleted === true;
    if (isOnboarded) return false;

    const hasOrg = !!(user.organizationId);
    const hasOrgMemberships = !!(user.organizationMemberships && user.organizationMemberships.length > 0);

    // If they already have org access through any means, they don't need onboarding
    return !hasOrg && !hasOrgMemberships;
}

/**
 * Client-side wrapper that:
 * 1. Checks for an auth token — redirects to /login if missing.
 * 2. Fetches the current user and provides the PermissionsProvider.
 * 3. Redirects truly new users to /onboarding if they haven't completed it.
 *
 * Should be placed near the root of the dashboard layout.
 */
export function PermissionsProviderWrapper({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [tokenChecked, setTokenChecked] = useState(false);

    // Early token check — avoids firing API calls when clearly not authenticated
    useEffect(() => {
        const token = AuthService.getToken();
        if (!token) {
            const redirectParam = pathname && pathname !== '/login' && pathname !== '/register'
                ? `?redirect=${encodeURIComponent(pathname)}`
                : '';
            router.replace(`/login${redirectParam}`);
        } else {
            setTokenChecked(true);
        }
    }, [router, pathname]);

    // Don't render anything until token check completes
    if (!tokenChecked) {
        return (
            <div className="flex items-center justify-center h-screen w-screen bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
            </div>
        );
    }

    return <AuthenticatedContent>{children}</AuthenticatedContent>;
}

/**
 * Inner component — only rendered when we know a token exists.
 * Fetches user data and provides the permissions context.
 * Redirects to onboarding if the user hasn't completed it yet.
 */
function AuthenticatedContent({ children }: { children: React.ReactNode }) {
    const { data: user, isLoading, isError, error, refetch, isFetching } = useCurrentUser();
    const router = useRouter();
    const pathname = usePathname();
    const { setTheme } = useTheme();
    const currentLocale = useLocale();
    const prefsApplied = useRef(false);
    const queryClient = useQueryClient();

    const status = ((error as any)?.response?.status ?? (error as any)?.status) as number | undefined;
    const isAuthError = status === 401 || status === 403;

    // If /me fails with auth error, redirect to login
    useEffect(() => {
        if (isError && isAuthError) {
            AuthService.logout();
            queryClient.clear();
            const redirectParam = pathname && pathname !== '/login' && pathname !== '/register'
                ? `?redirect=${encodeURIComponent(pathname)}`
                : '';
            router.replace(`/login${redirectParam}`);
        }
    }, [isError, isAuthError, router, pathname, queryClient]);

    // Redirect to onboarding if the user truly needs it
    useEffect(() => {
        if (user && userNeedsOnboarding(user)) {
            router.replace('/onboarding');
        }
    }, [user, router]);

    // Apply saved preferences on first load
    useEffect(() => {
        if (!user?.preferences || prefsApplied.current) return;
        prefsApplied.current = true;

        const prefs = user.preferences;

        // Apply theme
        if (prefs.theme) {
            setTheme(prefs.theme);
        }

        // Apply language (redirect to correct locale if different)
        if (prefs.language && prefs.language !== currentLocale && pathname) {
            const segments = pathname.split('/');
            if (segments[1] && ['en', 'es'].includes(segments[1])) {
                segments[1] = prefs.language;
                router.replace(segments.join('/'));
            }
        }
    }, [user, setTheme, currentLocale, pathname, router]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen w-screen bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
            </div>
        );
    }

    // Keep the user on screen for transient network/backend issues.
    // Do not force logout for "Failed to fetch" or API downtime.
    if (isError && !isAuthError) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 h-screen w-screen bg-background px-6 text-center">
                <div className="text-sm font-medium text-foreground">No se pudo conectar con el backend.</div>
                <div className="text-xs text-foreground-muted">
                    Verifica que la API esté corriendo y vuelve a intentar.
                </div>
                <button
                    type="button"
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="inline-flex items-center justify-center rounded-md bg-accent-blue px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                    {isFetching ? 'Reintentando...' : 'Reintentar'}
                </button>
            </div>
        );
    }

    // Prevent flash of dashboard content while redirecting to onboarding
    if (userNeedsOnboarding(user)) {
        return (
            <div className="flex items-center justify-center h-screen w-screen bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
            </div>
        );
    }

    return (
        <ActiveOrganizationProvider memberships={user?.organizationMemberships ?? []}>
            <PermissionsProvider user={user}>
                {children}
            </PermissionsProvider>
        </ActiveOrganizationProvider>
    );
}
