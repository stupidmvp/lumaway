import { useMemo } from 'react';
import { useProject } from './projects.hooks';
import { usePermissions } from '../permissions/PermissionsProvider';
import { DEFAULT_PROJECT_SETTINGS, type ProjectSettings } from '../services/projects.service';

export interface ProjectSettingsPermissions {
    /** Whether the current user can publish/unpublish walkthroughs */
    canPublish: boolean;
    /** Whether the current user can delete walkthroughs */
    canDeleteWalkthrough: boolean;
    /** Whether the current user can invite new members */
    canInviteMembers: boolean;
    /** Whether the current user can comment */
    canComment: boolean;
    /** Whether the current user can export data */
    canExport: boolean;
    /** Whether project settings data is still loading */
    isLoading: boolean;
    /** The resolved project settings (with defaults applied) */
    settings: ProjectSettings;
}

/**
 * Hook that combines the user's project role with the project-level settings
 * to produce fine-grained permission flags.
 *
 * Project owners and org admins/owners always bypass project settings restrictions.
 * SuperAdmins always have full access.
 *
 * For editors: permissions are gated by project settings (`editorCanPublish`, `editorCanDelete`, `editorCanInvite`).
 * For viewers: permissions are gated by project settings (`viewerCanComment`, `viewerCanExport`).
 */
export function useProjectSettingsPermissions(projectId: string | undefined): ProjectSettingsPermissions {
    const { data: project, isLoading } = useProject(projectId || '');
    const permissions = usePermissions();

    return useMemo(() => {
        // Merge saved settings with defaults so every key is defined
        const rawSettings = (project?.settings as ProjectSettings) || {};
        const settings: ProjectSettings = { ...DEFAULT_PROJECT_SETTINGS, ...rawSettings };

        // If no projectId or still loading, return safe defaults (everything false except loading)
        if (!projectId || isLoading || !project) {
            return {
                canPublish: false,
                canDeleteWalkthrough: false,
                canInviteMembers: false,
                canComment: false,
                canExport: false,
                isLoading,
                settings,
            };
        }

        const organizationId = project.organizationId;
        const ctx = { projectId, organizationId };

        // SuperAdmin, org admin/owner, or project owner → full access, bypass settings
        const isSuperAdmin = permissions.isSuperAdmin();
        const isOrgAdmin = permissions.isOrgAdminOrOwner(organizationId);
        const isProjectOwner = permissions.getProjectRole(projectId) === 'owner';
        const hasFullAccess = isSuperAdmin || isOrgAdmin || isProjectOwner;

        if (hasFullAccess) {
            return {
                canPublish: true,
                canDeleteWalkthrough: true,
                canInviteMembers: true,
                canComment: true,
                canExport: true,
                isLoading: false,
                settings,
            };
        }

        // Determine the user's project role
        const projectRole = permissions.getProjectRole(projectId);

        // ── Editor permissions (gated by project settings) ──
        const isEditor = projectRole === 'editor';
        const canPublish = isEditor && (settings.editorCanPublish ?? true);
        const canDeleteWalkthrough = isEditor && (settings.editorCanDelete ?? false);
        const canInviteMembers = isEditor && (settings.editorCanInvite ?? true);

        // ── Viewer permissions (gated by project settings) ──
        const isViewer = projectRole === 'viewer';
        // Editors can always comment; viewers depend on settings
        const canComment = isEditor || (isViewer && (settings.viewerCanComment ?? true));
        // Editors can always export; viewers depend on settings
        const canExport = isEditor || (isViewer && (settings.viewerCanExport ?? true));

        return {
            canPublish,
            canDeleteWalkthrough,
            canInviteMembers,
            canComment,
            canExport,
            isLoading: false,
            settings,
        };
    }, [project, projectId, isLoading, permissions]);
}

