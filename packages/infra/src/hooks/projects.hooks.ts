import { useQuery, useMutation, useQueryClient, useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { ProjectsService, type ProjectSettings } from '../services/projects.service';

export const useProjects = (
    search?: string,
    limit: number = 10,
    skip: number = 0,
    filters?: { status?: string }
) => {
    return useQuery({
        queryKey: ['projects', search, limit, skip, filters],
        queryFn: () => {
            const query: Record<string, any> = {
                $sort: { createdAt: -1 },
                $limit: limit,
                $skip: skip
            };

            if (search && search.trim().length > 0) {
                query.search = search;
            }

            if (filters?.status && filters.status !== 'all') {
                query.status = filters.status;
            }

            return ProjectsService.getAll(query);
        },
        placeholderData: keepPreviousData,
    });
};

export const useInfiniteProjects = (search?: string, limit: number = 10) => {
    return useInfiniteQuery({
        queryKey: ['projects', 'infinite', search, limit],
        queryFn: async ({ pageParam = 0 }) => {
            const query: Record<string, any> = {
                $sort: { createdAt: -1 },
                $limit: limit,
                $skip: pageParam
            };

            if (search && search.trim().length > 0) {
                query.search = search;
            }

            return ProjectsService.getAll(query);
        },
        getNextPageParam: (lastPage: any, allPages) => {
            const projects = Array.isArray(lastPage) ? lastPage : lastPage?.data || [];
            // If we got fewer items than the limit, we've reached the end
            if (projects.length < limit) return undefined;
            // Otherwise, next skip is total items fetched so far
            return allPages.length * limit;
        },
        initialPageParam: 0
    });
};

export const useCreateProject = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ProjectsService.create,
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['projects'] }),
                queryClient.refetchQueries({ queryKey: ['projects'], type: 'active' })
            ]);
        },
    });
};

export const useProject = (id: string) => {
    return useQuery({
        queryKey: ['projects', id],
        queryFn: () => ProjectsService.getById(id),
        enabled: !!id,
    });
};

export const useUpdateProject = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<import('../services/projects.service').Project> }) =>
            ProjectsService.update(id, data),
        onSuccess: async (data) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['projects', data.id] }),
                queryClient.invalidateQueries({ queryKey: ['projects'] }),
                queryClient.refetchQueries({ queryKey: ['projects'], type: 'active' })
            ]);
        },
    });
};

export const useDeleteProject = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => ProjectsService.delete(id),
        onSuccess: async (_, id) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['projects', id] }),
                queryClient.invalidateQueries({ queryKey: ['projects'] }),
                queryClient.refetchQueries({ queryKey: ['projects'], type: 'active' })
            ]);
        },
    });
};

export const useUpdateProjectSettings = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, settings }: { id: string; settings: Partial<ProjectSettings> }) =>
            ProjectsService.updateSettings(id, settings),
        onSuccess: async (data) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['projects', data.id] }),
                queryClient.invalidateQueries({ queryKey: ['projects'] }),
            ]);
        },
    });
};
