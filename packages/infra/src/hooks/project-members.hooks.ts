import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { ProjectMembersService } from '../services/project-members.service';

export const useProjectMembers = (
    projectId: string | undefined,
    search?: string,
    limit: number = 20,
    skip: number = 0,
    filters?: { role?: string; includeOwner?: boolean }
) => {
    return useQuery({
        queryKey: ['project-members', projectId, search, limit, skip, filters],
        queryFn: () => {
            const query: Record<string, any> = {
                projectId,
                $sort: { createdAt: -1 },
                $limit: limit,
                $skip: skip,
            };

            if (search && search.trim().length > 0) {
                query.search = search;
            }

            if (filters?.role && filters.role !== 'all') {
                query.role = filters.role;
            }

            if (filters?.includeOwner) {
                query.$includeOwner = true;
            }

            return ProjectMembersService.getAll(query);
        },
        enabled: !!projectId,
        placeholderData: keepPreviousData,
    });
};

export const useUpdateMemberRole = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, role, projectId }: { id: string; role: string; projectId: string }) =>
            ProjectMembersService.updateRole(id, role),
        onSuccess: async (_, variables) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['project-members', variables.projectId] }),
                queryClient.refetchQueries({ queryKey: ['project-members', variables.projectId] }),
            ]);
        },
    });
};

export const useRemoveMember = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, projectId }: { id: string; projectId: string }) =>
            ProjectMembersService.remove(id),
        onSuccess: async (_, variables) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['project-members', variables.projectId] }),
                queryClient.refetchQueries({ queryKey: ['project-members', variables.projectId] }),
            ]);
        },
    });
};

