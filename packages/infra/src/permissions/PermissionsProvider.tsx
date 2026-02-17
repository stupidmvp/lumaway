'use client';

import React, { createContext, useContext, useMemo } from 'react';
import type { User } from '../services/users.service';
import { Permissions, type Action, type Subject, type PermissionContext } from './permissions';
import { useActiveOrganization } from '../context/ActiveOrganizationProvider';

// ═══════════════════════════════════════════════════════════
// Context
// ═══════════════════════════════════════════════════════════

const PermissionsContext = createContext<Permissions>(new Permissions(null));

// ═══════════════════════════════════════════════════════════
// Provider
// ═══════════════════════════════════════════════════════════

interface PermissionsProviderProps {
    user: User | null | undefined;
    children: React.ReactNode;
}

/**
 * Wrap your app (or dashboard layout) with this provider.
 * It creates a Permissions instance from the current user data.
 *
 * Usage:
 * ```tsx
 * <PermissionsProvider user={currentUser}>
 *   <App />
 * </PermissionsProvider>
 * ```
 */
export function PermissionsProvider({ user, children }: PermissionsProviderProps) {
    const { activeOrgId } = useActiveOrganization();
    const permissions = useMemo(() => new Permissions(user, activeOrgId), [user, activeOrgId]);
    return (
        <PermissionsContext.Provider value={permissions}>
            {children}
        </PermissionsContext.Provider>
    );
}

// ═══════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════

/**
 * Access the Permissions instance anywhere in the component tree.
 *
 * Usage:
 * ```tsx
 * const permissions = usePermissions();
 * if (permissions.can('create', 'projects')) { ... }
 * ```
 */
export function usePermissions(): Permissions {
    return useContext(PermissionsContext);
}

// ═══════════════════════════════════════════════════════════
// <Can> component
// ═══════════════════════════════════════════════════════════

interface CanProps {
    /** The action to check (create, read, update, delete, manage) */
    action: Action;
    /** The subject/resource to check */
    subject: Subject;
    /** Optional context (organizationId, projectId) */
    context?: PermissionContext;
    /** Content to render when permission is granted */
    children: React.ReactNode;
    /** Optional fallback to render when permission is denied */
    fallback?: React.ReactNode;
}

/**
 * Declarative permission gate component.
 *
 * Renders children only if the current user has the specified permission.
 *
 * Usage:
 * ```tsx
 * <Can action="create" subject="walkthroughs" context={{ projectId }}>
 *   <Button>New Walkthrough</Button>
 * </Can>
 *
 * <Can action="delete" subject="projects" context={{ projectId }} fallback={<span>Read-only</span>}>
 *   <Button variant="destructive">Delete</Button>
 * </Can>
 * ```
 */
export function Can({ action, subject, context, children, fallback = null }: CanProps) {
    const permissions = usePermissions();

    if (permissions.can(action, subject, context)) {
        return <>{children}</>;
    }

    return <>{fallback}</>;
}

