import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminService } from '../services/admin.service';

// ═══════════════════════════════════════════════════════════
// Users
// ═══════════════════════════════════════════════════════════

export const useAdminUsers = (params?: {
    search?: string;
    status?: string;
    $limit?: number;
    $skip?: number;
}) => {
    return useQuery({
        queryKey: ['admin', 'users', params],
        queryFn: () => AdminService.getUsers(params),
        staleTime: 30 * 1000, // 30 seconds
    });
};

export const useAdminUser = (id: string) => {
    return useQuery({
        queryKey: ['admin', 'users', id],
        queryFn: () => AdminService.getUser(id),
        enabled: !!id,
    });
};

export const useAdminUpdateUser = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: { status?: string; firstName?: string; lastName?: string } }) =>
            AdminService.updateUser(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
        },
    });
};

export const useAdminUpdateUserRoles = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, roleIds }: { userId: string; roleIds: string[] }) =>
            AdminService.updateUserRoles(userId, roleIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
        },
    });
};

// ═══════════════════════════════════════════════════════════
// Roles
// ═══════════════════════════════════════════════════════════

export const useAdminRoles = () => {
    return useQuery({
        queryKey: ['admin', 'roles'],
        queryFn: () => AdminService.getRoles(),
        staleTime: 60 * 1000, // 1 minute
    });
};

export const useAdminCreateRole = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { name: string; description?: string }) =>
            AdminService.createRole(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
        },
    });
};

export const useAdminUpdateRole = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string } }) =>
            AdminService.updateRole(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
        },
    });
};

export const useAdminDeleteRole = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => AdminService.deleteRole(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
        },
    });
};

// ═══════════════════════════════════════════════════════════
// Role Permissions
// ═══════════════════════════════════════════════════════════

export const useAdminRolePermissions = (roleId: string) => {
    return useQuery({
        queryKey: ['admin', 'roles', roleId, 'permissions'],
        queryFn: () => AdminService.getRolePermissions(roleId),
        enabled: !!roleId,
    });
};

export const useAdminUpdateRolePermissions = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ roleId, permissionIds }: { roleId: string; permissionIds: string[] }) =>
            AdminService.updateRolePermissions(roleId, permissionIds),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'roles', variables.roleId, 'permissions'] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
        },
    });
};

// ═══════════════════════════════════════════════════════════
// Permissions
// ═══════════════════════════════════════════════════════════

export const useAdminPermissions = () => {
    return useQuery({
        queryKey: ['admin', 'permissions'],
        queryFn: () => AdminService.getPermissions(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

// ═══════════════════════════════════════════════════════════
// System Secrets
// ═══════════════════════════════════════════════════════════

export const useSystemSecrets = () => {
    return useQuery({
        queryKey: ['admin', 'system-secrets'],
        queryFn: () => AdminService.getSecrets(),
        staleTime: 30 * 1000,
    });
};

export const useCreateSystemSecret = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { keyName: string; keyValue: string; provider: string }) =>
            AdminService.createSecret(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'system-secrets'] });
        },
    });
};

export const useUpdateSystemSecret = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: { keyName?: string; keyValue?: string; provider?: string } }) =>
            AdminService.updateSecret(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'system-secrets'] });
        },
    });
};

export const useDeleteSystemSecret = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => AdminService.deleteSecret(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'system-secrets'] });
        },
    });
};
