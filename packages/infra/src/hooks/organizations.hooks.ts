import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { OrganizationsService, UpdateOrganizationData, CreateOrganizationData } from '../services/organizations.service';

export const useMyOrganization = () => {
    return useQuery({
        queryKey: ['myOrganization'],
        queryFn: () => OrganizationsService.getMyOrganization(),
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: false,
    });
};

export const useMyOrganizations = () => {
    return useQuery({
        queryKey: ['myOrganizations'],
        queryFn: () => OrganizationsService.getMyOrganizations(),
        staleTime: 5 * 60 * 1000,
        retry: false,
    });
};

export const useCreateOrganization = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateOrganizationData) => OrganizationsService.createOrganization(data),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['myOrganization'] }),
                queryClient.invalidateQueries({ queryKey: ['myOrganizations'] }),
                queryClient.invalidateQueries({ queryKey: ['currentUser'] }),
            ]);
        },
    });
};

export const useUpdateOrganization = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: UpdateOrganizationData) => OrganizationsService.updateMyOrganization(data),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['myOrganization'] }),
                queryClient.invalidateQueries({ queryKey: ['myOrganizations'] }),
                queryClient.invalidateQueries({ queryKey: ['currentUser'] }),
            ]);
        },
    });
};

export const useDeleteOrganization = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (orgId: string) => OrganizationsService.deleteOrganization(orgId),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['myOrganization'] }),
                queryClient.invalidateQueries({ queryKey: ['myOrganizations'] }),
                queryClient.invalidateQueries({ queryKey: ['currentUser'] }),
            ]);
        },
    });
};

export const useLeaveOrganization = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (orgId: string) => OrganizationsService.leaveOrganization(orgId),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['myOrganization'] }),
                queryClient.invalidateQueries({ queryKey: ['myOrganizations'] }),
                queryClient.invalidateQueries({ queryKey: ['currentUser'] }),
            ]);
        },
    });
};

export const useOrganizationMembers = (orgId: string | undefined) => {
    return useQuery({
        queryKey: ['organizationMembers', orgId],
        queryFn: () => OrganizationsService.getOrganizationMembers(orgId!),
        enabled: !!orgId,
        staleTime: 2 * 60 * 1000, // 2 minutes
    });
};

export const useUpdateOrganizationMemberRole = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
            OrganizationsService.updateOrganizationMemberRole(memberId, role),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['organizationMembers'] });
        },
    });
};

export const useRemoveOrganizationMember = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (memberId: string) => OrganizationsService.removeOrganizationMember(memberId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['organizationMembers'] });
        },
    });
};
