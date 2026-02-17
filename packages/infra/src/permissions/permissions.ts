import type { User, UserOrgMembership, UserProjectMembership } from '../services/users.service';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export type OrgRole = 'owner' | 'admin' | 'member';
export type ProjectRole = 'owner' | 'editor' | 'viewer';

/** Subjects the permission system understands */
export type Subject =
    | 'projects'
    | 'walkthroughs'
    | 'organizations'
    | 'organization_members'
    | 'project_members'
    | 'project_invitations'
    | 'api_keys'
    | 'comments';

/** Actions the permission system understands */
export type Action = 'create' | 'read' | 'update' | 'delete' | 'manage';

/** Optional context for permission checks */
export interface PermissionContext {
    organizationId?: string;
    projectId?: string;
}

// ═══════════════════════════════════════════════════════════
// Role hierarchies
// ═══════════════════════════════════════════════════════════

const ORG_ROLE_LEVEL: Record<OrgRole, number> = {
    member: 1,
    admin: 2,
    owner: 3,
};

const PROJECT_ROLE_LEVEL: Record<ProjectRole, number> = {
    viewer: 1,
    editor: 2,
    owner: 3,
};

// ═══════════════════════════════════════════════════════════
// Core permission checker
// ═══════════════════════════════════════════════════════════

export class Permissions {
    private user: User | null;
    private globalRoles: string[];
    private orgMemberships: UserOrgMembership[];
    private projectMemberships: UserProjectMembership[];
    /** The currently active organization — used as default when no organizationId is provided in context */
    private activeOrganizationId: string | null;

    constructor(user: User | null | undefined, activeOrganizationId?: string | null) {
        this.user = user ?? null;
        this.globalRoles = user?.globalRoles ?? [];
        this.orgMemberships = user?.organizationMemberships ?? [];
        this.projectMemberships = user?.projectMemberships ?? [];
        this.activeOrganizationId = activeOrganizationId ?? null;

        // Bind public methods so destructuring (e.g. const { can } = usePermissions()) keeps `this`
        this.can = this.can.bind(this);
        this.cannot = this.cannot.bind(this);
    }

    /** Returns the active organization ID */
    getActiveOrganizationId(): string | null {
        return this.activeOrganizationId;
    }

    // ─── Identity checks ────────────────────────────────────

    /** Is the user a superadmin? */
    isSuperAdmin(): boolean {
        return this.globalRoles.includes('superadmin');
    }

    /** Does the user have a specific global role? */
    hasGlobalRole(role: string): boolean {
        return this.globalRoles.includes(role);
    }

    // ─── Organization role checks ───────────────────────────

    /** Get the user's role in a specific organization */
    getOrgRole(organizationId: string): OrgRole | null {
        const m = this.orgMemberships.find(m => m.organizationId === organizationId);
        return m?.role ?? null;
    }

    /** Check if user has at least the given org role */
    hasOrgRole(minRole: OrgRole, organizationId?: string): boolean {
        if (this.isSuperAdmin()) return true;
        if (!organizationId) {
            // Check across ALL orgs
            return this.orgMemberships.some(
                m => ORG_ROLE_LEVEL[m.role] >= ORG_ROLE_LEVEL[minRole]
            );
        }
        const role = this.getOrgRole(organizationId);
        if (!role) return false;
        return ORG_ROLE_LEVEL[role] >= ORG_ROLE_LEVEL[minRole];
    }

    /** Is user an owner or admin of any organization? */
    isOrgAdminOrOwner(organizationId?: string): boolean {
        return this.hasOrgRole('admin', organizationId);
    }

    /** Is user an owner of any/specific organization? */
    isOrgOwner(organizationId?: string): boolean {
        return this.hasOrgRole('owner', organizationId);
    }

    /** Get the primary organization (highest role) */
    getPrimaryOrg(): UserOrgMembership | null {
        if (this.orgMemberships.length === 0) return null;
        return [...this.orgMemberships].sort(
            (a, b) => ORG_ROLE_LEVEL[b.role] - ORG_ROLE_LEVEL[a.role]
        )[0] ?? null;
    }

    // ─── Project role checks ────────────────────────────────

    /** Get the user's direct role in a specific project */
    getProjectRole(projectId: string): ProjectRole | null {
        const m = this.projectMemberships.find(m => m.projectId === projectId);
        return m?.role ?? null;
    }

    /** Check if user has at least the given project role (direct or via org) */
    hasProjectRole(minRole: ProjectRole, projectId: string, organizationId?: string): boolean {
        if (this.isSuperAdmin()) return true;

        // Direct project membership
        const directRole = this.getProjectRole(projectId);
        if (directRole && PROJECT_ROLE_LEVEL[directRole] >= PROJECT_ROLE_LEVEL[minRole]) {
            return true;
        }

        // Org-level access: org owner/admin has implicit owner-level project access
        if (organizationId && this.isOrgAdminOrOwner(organizationId)) {
            return true;
        }

        return false;
    }

    // ─── Subject+Action permission checks ───────────────────

    /**
     * Main permission check: can the user perform `action` on `subject`?
     *
     * Examples:
     *   can('create', 'projects')                        → can create projects in any org?
     *   can('create', 'projects', { organizationId })    → can create in that org?
     *   can('update', 'walkthroughs', { projectId })     → can edit walkthroughs in that project?
     *   can('manage', 'organization_members', { organizationId }) → can manage org members?
     */
    can(action: Action, subject: Subject, context?: PermissionContext): boolean {
        if (!this.user) return false;
        if (this.isSuperAdmin()) return true;

        // Default organizationId to the active organization when not explicitly provided
        const organizationId = context?.organizationId ?? this.activeOrganizationId ?? undefined;
        const projectId = context?.projectId;

        switch (subject) {
            // ── Organizations ──────────────────────────────
            case 'organizations':
                if (action === 'read') {
                    // Any member can read their org
                    return organizationId
                        ? !!this.getOrgRole(organizationId)
                        : this.orgMemberships.length > 0;
                }
                // update/manage org settings → owner/admin
                return this.isOrgAdminOrOwner(organizationId);

            // ── Organization Members ───────────────────────
            case 'organization_members':
                if (action === 'read') {
                    return organizationId
                        ? !!this.getOrgRole(organizationId)
                        : this.orgMemberships.length > 0;
                }
                // manage members → owner/admin
                return this.isOrgAdminOrOwner(organizationId);

            // ── Projects ───────────────────────────────────
            case 'projects':
                if (action === 'create') {
                    // Only org owner/admin can create projects
                    return this.isOrgAdminOrOwner(organizationId);
                }
                if (action === 'read') {
                    return projectId
                        ? this.hasProjectRole('viewer', projectId, organizationId)
                        : true; // listing is server-filtered
                }
                if (action === 'update') {
                    return projectId
                        ? this.hasProjectRole('owner', projectId, organizationId)
                        : false;
                }
                if (action === 'delete') {
                    return projectId
                        ? this.hasProjectRole('owner', projectId, organizationId)
                        : false;
                }
                return false;

            // ── Walkthroughs ───────────────────────────────
            case 'walkthroughs':
                if (action === 'create' || action === 'update') {
                    return projectId
                        ? this.hasProjectRole('editor', projectId, organizationId)
                        : this.isOrgAdminOrOwner(); // if no project context, check any org
                }
                if (action === 'read') {
                    return projectId
                        ? this.hasProjectRole('viewer', projectId, organizationId)
                        : true;
                }
                if (action === 'delete') {
                    return projectId
                        ? this.hasProjectRole('owner', projectId, organizationId)
                        : false;
                }
                return false;

            // ── Project Members / Invitations ──────────────
            case 'project_members':
            case 'project_invitations':
                if (action === 'read') {
                    return projectId
                        ? this.hasProjectRole('viewer', projectId, organizationId)
                        : false;
                }
                // manage members/invitations → project owner or org admin
                return projectId
                    ? this.hasProjectRole('owner', projectId, organizationId)
                    : false;

            // ── API Keys ───────────────────────────────────
            case 'api_keys':
                if (action === 'read') {
                    return projectId
                        ? this.hasProjectRole('viewer', projectId, organizationId)
                        : false;
                }
                // create/delete keys → project owner or org admin
                return projectId
                    ? this.hasProjectRole('owner', projectId, organizationId)
                    : this.isOrgAdminOrOwner(); // if no project context, check any org

            // ── Comments ───────────────────────────────────
            case 'comments':
                if (action === 'read' || action === 'create') {
                    return projectId
                        ? this.hasProjectRole('viewer', projectId, organizationId)
                        : true;
                }
                // update/delete own comments handled at component level
                // delete others' comments → project owner
                return projectId
                    ? this.hasProjectRole('owner', projectId, organizationId)
                    : false;

            default:
                return false;
        }
    }

    /**
     * Inverse of `can` — convenience method
     */
    cannot(action: Action, subject: Subject, context?: PermissionContext): boolean {
        return !this.can(action, subject, context);
    }
}

