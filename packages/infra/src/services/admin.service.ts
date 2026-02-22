import { httpClient } from '../http/client';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export interface AdminUser {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    avatar?: string | null;
    status: 'active' | 'inactive' | 'suspended';
    organizationId?: string | null;
    organizationName?: string | null;
    globalRoles: string[];
    createdAt: string;
    updatedAt: string;
}

export interface AdminRole {
    id: string;
    name: string;
    description?: string | null;
    usersCount: number;
    permissionsCount: number;
    createdAt: string;
}

export interface AdminPermission {
    id: string;
    name: string;
    description?: string | null;
}

export interface AdminModulePermissions {
    module: {
        id: string;
        name: string;
        key: string;
    };
    permissions: AdminPermission[];
}

export interface AdminRolePermission {
    permissionId: string;
    permissionName: string;
    permissionDescription?: string | null;
    moduleId: string;
    moduleName: string;
    moduleKey: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    limit: number;
    skip: number;
}

// ═══════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════

export const AdminService = {
    // ─── Users ─────────────────────────────────────────────────
    async getUsers(params?: {
        search?: string;
        status?: string;
        $limit?: number;
        $skip?: number;
    }): Promise<PaginatedResponse<AdminUser>> {
        const { data } = await httpClient.get<PaginatedResponse<AdminUser>>('/admin-users', { params });
        return data;
    },

    async getUser(id: string): Promise<AdminUser & { roleDetails: { roleId: string; roleName: string; roleDescription?: string }[] }> {
        const { data } = await httpClient.get(`/admin-users/${id}`);
        return data;
    },

    async updateUser(id: string, data: { status?: string; firstName?: string; lastName?: string }): Promise<AdminUser> {
        const { data: result } = await httpClient.patch<AdminUser>(`/admin-users/${id}`, data);
        return result;
    },

    async updateUserRoles(userId: string, roleIds: string[]): Promise<{ userId: string; roles: { roleId: string; roleName: string }[] }> {
        const { data } = await httpClient.patch(`/admin-user-roles/${userId}`, { roleIds });
        return data;
    },

    // ─── Roles ─────────────────────────────────────────────────
    async getRoles(): Promise<{ data: AdminRole[]; total: number }> {
        const { data } = await httpClient.get<{ data: AdminRole[]; total: number }>('/admin-roles');
        return data;
    },

    async createRole(data: { name: string; description?: string }): Promise<AdminRole> {
        const { data: result } = await httpClient.post<AdminRole>('/admin-roles', data);
        return result;
    },

    async updateRole(id: string, data: { name?: string; description?: string }): Promise<AdminRole> {
        const { data: result } = await httpClient.patch<AdminRole>(`/admin-roles/${id}`, data);
        return result;
    },

    async deleteRole(id: string): Promise<void> {
        await httpClient.delete(`/admin-roles/${id}`);
    },

    // ─── Role Permissions ──────────────────────────────────────
    async getRolePermissions(roleId: string): Promise<{ roleId: string; permissions: AdminRolePermission[] }> {
        const { data } = await httpClient.get(`/admin-role-permissions/${roleId}`);
        return data;
    },

    async updateRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
        await httpClient.patch(`/admin-role-permissions/${roleId}`, { permissionIds });
    },

    // ─── Permissions ───────────────────────────────────────────
    async getPermissions(): Promise<{ data: AdminModulePermissions[] }> {
        const { data } = await httpClient.get<{ data: AdminModulePermissions[] }>('/admin-permissions');
        return data;
    },

    // ─── System Secrets ────────────────────────────────────────
    async getSecrets(): Promise<{ data: SystemSecret[]; total: number }> {
        const { data } = await httpClient.get<{ data: SystemSecret[]; total: number }>('/system-secrets');
        return data;
    },

    async createSecret(secretData: { keyName: string; keyValue: string; provider: string }): Promise<SystemSecret> {
        const { data } = await httpClient.post<SystemSecret>('/system-secrets', secretData);
        return data;
    },

    async updateSecret(id: string, secretData: { keyName?: string; keyValue?: string; provider?: string }): Promise<SystemSecret> {
        const { data } = await httpClient.patch<SystemSecret>(`/system-secrets/${id}`, secretData);
        return data;
    },

    async deleteSecret(id: string): Promise<void> {
        await httpClient.delete(`/system-secrets/${id}`);
    },
};

// ═══════════════════════════════════════════════════════════
// System Secret Type
// ═══════════════════════════════════════════════════════════

export interface SystemSecret {
    id: string;
    keyName: string;
    keyValue: string; // redacted from API (e.g. "•••••FyS2")
    provider: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
