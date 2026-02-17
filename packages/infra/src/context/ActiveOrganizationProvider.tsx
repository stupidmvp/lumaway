'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { OrganizationMembership } from '../services/organizations.service';
import type { UserOrgMembership } from '../services/users.service';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export interface ActiveOrganizationContextValue {
    /** The currently active organization, or null if none selected */
    activeOrg: OrganizationMembership | null;
    /** All organizations the user is a member of */
    organizations: OrganizationMembership[];
    /** Whether organizations are still being loaded */
    isLoading: boolean;
    /** Switch to a different organization by its ID */
    switchOrganization: (orgId: string) => void;
    /** The active organization ID (shorthand) */
    activeOrgId: string | null;
}

const STORAGE_KEY = 'lumaway_active_org';

const ActiveOrganizationContext = createContext<ActiveOrganizationContextValue>({
    activeOrg: null,
    organizations: [],
    isLoading: true,
    switchOrganization: () => {},
    activeOrgId: null,
});

// ═══════════════════════════════════════════════════════════
// Provider
// ═══════════════════════════════════════════════════════════

interface ActiveOrganizationProviderProps {
    /** The user's organization memberships (from /me endpoint) */
    memberships: UserOrgMembership[];
    children: React.ReactNode;
}

/**
 * Provides the active organization context to the app.
 *
 * Reads `memberships` from the user data and maps them to `OrganizationMembership`.
 * Persists the selected org in localStorage so it survives page reloads.
 *
 * When the org changes, it invalidates all org-scoped React Query caches
 * to trigger fresh fetches for the new org context.
 */
export function ActiveOrganizationProvider({ memberships, children }: ActiveOrganizationProviderProps) {
    const queryClient = useQueryClient();

    // Map UserOrgMembership → OrganizationMembership shape (sorted alphabetically)
    const organizations: OrganizationMembership[] = useMemo(
        () =>
            memberships
                .map((m) => ({
                    id: m.organizationId,
                    name: m.organization?.name ?? '',
                    slug: m.organization?.slug ?? '',
                    logo: m.organization?.logo ?? null,
                    role: m.role,
                    membershipId: m.organizationId, // using orgId as fallback
                }))
                .sort((a, b) => a.name.localeCompare(b.name)),
        [memberships]
    );

    // Resolve activeOrgId synchronously so the first render already has a value.
    // Priority: localStorage → best-role org from memberships → null
    const [activeOrgId, setActiveOrgId] = useState<string | null>(() => {
        if (typeof window === 'undefined') return memberships[0]?.organizationId ?? null;

        const stored = localStorage.getItem(STORAGE_KEY);
        // If stored ID exists in current memberships, use it
        if (stored && memberships.some((m) => m.organizationId === stored)) {
            return stored;
        }

        // No valid stored ID — pick the org with the highest role
        if (memberships.length > 0) {
            const order: Record<string, number> = { owner: 3, admin: 2, member: 1 };
            const sorted = [...memberships].sort(
                (a, b) => (order[b.role] ?? 0) - (order[a.role] ?? 0)
            );
            const bestId = sorted[0]?.organizationId ?? null;
            if (bestId) {
                localStorage.setItem(STORAGE_KEY, bestId);
            }
            return bestId;
        }

        return null;
    });

    // Keep in sync when memberships change (e.g. user gets added/removed from an org)
    useEffect(() => {
        if (organizations.length === 0) {
            setActiveOrgId(null);
            return;
        }

        // If current active org no longer exists in the list, pick a new one
        const exists = organizations.some((o) => o.id === activeOrgId);
        if (!exists) {
            const order: Record<string, number> = { owner: 3, admin: 2, member: 1 };
            const sorted = [...organizations].sort(
                (a, b) => (order[b.role] ?? 0) - (order[a.role] ?? 0)
            );
            const fallbackId = sorted[0]?.id ?? null;
            setActiveOrgId(fallbackId);
            if (fallbackId) {
                localStorage.setItem(STORAGE_KEY, fallbackId);
            }
        }
    }, [organizations, activeOrgId]);

    const activeOrg = useMemo(
        () => organizations.find((o) => o.id === activeOrgId) ?? null,
        [organizations, activeOrgId]
    );

    const switchOrganization = useCallback(
        (orgId: string) => {
            if (orgId === activeOrgId) return;

            setActiveOrgId(orgId);
            localStorage.setItem(STORAGE_KEY, orgId);

            // Invalidate all org-scoped queries so they refetch for the new org
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            queryClient.invalidateQueries({ queryKey: ['walkthroughs'] });
            queryClient.invalidateQueries({ queryKey: ['myOrganization'] });
            queryClient.invalidateQueries({ queryKey: ['organizationMembers'] });
            queryClient.invalidateQueries({ queryKey: ['projectMembers'] });
            queryClient.invalidateQueries({ queryKey: ['projectInvitations'] });
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
        },
        [activeOrgId, queryClient]
    );

    const value: ActiveOrganizationContextValue = useMemo(
        () => ({
            activeOrg,
            organizations,
            isLoading: false,
            switchOrganization,
            activeOrgId,
        }),
        [activeOrg, organizations, switchOrganization, activeOrgId]
    );

    return (
        <ActiveOrganizationContext.Provider value={value}>
            {children}
        </ActiveOrganizationContext.Provider>
    );
}

// ═══════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════

/**
 * Access the active organization context.
 *
 * Usage:
 * ```tsx
 * const { activeOrg, switchOrganization, organizations } = useActiveOrganization();
 * ```
 */
export function useActiveOrganization(): ActiveOrganizationContextValue {
    return useContext(ActiveOrganizationContext);
}

