import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { WalkthroughsService, Walkthrough } from '../services/walkthroughs.service';

export const useWalkthroughs = (
    search?: string,
    limit: number = 10,
    skip: number = 0,
    filters?: { isPublished?: boolean; projectId?: string; tags?: string[]; actorId?: string }
) => {
    return useQuery({
        queryKey: ['walkthroughs', search, limit, skip, filters],
        queryFn: () => {
            const query: Record<string, any> = {
                $sort: { createdAt: -1 },
                $limit: limit,
                $skip: skip
            };

            if (search && search.trim().length > 0) {
                query.search = search;
            }

            if (filters?.isPublished !== undefined) {
                query.isPublished = filters.isPublished;
            }

            if (filters?.projectId) {
                query.projectId = filters.projectId;
            }

            if (filters?.tags && filters.tags.length > 0) {
                query['tags[]'] = filters.tags;
            }

            if (filters?.actorId) {
                query.actorId = filters.actorId;
            }

            return WalkthroughsService.getAll(query);
        },
        placeholderData: keepPreviousData,
    });
};

export const useWalkthrough = (id: string) => {
    return useQuery({
        queryKey: ['walkthroughs', id],
        queryFn: () => WalkthroughsService.getById(id),
        enabled: !!id,
    });
};

export const useWalkthroughsByProject = (projectId: string) => {
    return useQuery({
        queryKey: ['walkthroughs', 'project', projectId],
        queryFn: () => WalkthroughsService.getByProject(projectId),
        enabled: !!projectId,
    });
};

export const useCreateWalkthrough = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: WalkthroughsService.create,
        onSuccess: async (_, variables) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['walkthroughs'] }),
                queryClient.refetchQueries({ queryKey: ['walkthroughs'], type: 'active' })
            ]);
            if (variables.projectId) {
                await queryClient.invalidateQueries({ queryKey: ['walkthroughs', 'project', variables.projectId] });
            }
            if (variables.parentId) {
                await queryClient.invalidateQueries({ queryKey: ['walkthroughs', 'children', variables.parentId] });
            }
        },
    });
};

export const useUpdateWalkthrough = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Walkthrough> }) =>
            WalkthroughsService.update(id, data),
        onSuccess: async (updated) => {
            // Reset infinite query pages for versions so the new version appears at the top
            queryClient.removeQueries({ queryKey: ['walkthrough-versions', updated.id] });
            await Promise.all([
                queryClient.refetchQueries({ queryKey: ['walkthroughs', updated.id] }),
                queryClient.invalidateQueries({ queryKey: ['walkthroughs'] }),
                queryClient.invalidateQueries({ queryKey: ['walkthroughs', 'project', updated.projectId] }),
                queryClient.invalidateQueries({ queryKey: ['walkthrough-versions', updated.id] }),
                queryClient.refetchQueries({ queryKey: ['walkthroughs'], type: 'active' })
            ]);
        },
    });
};

export const useSubWalkthroughs = (parentId: string) => {
    return useQuery({
        queryKey: ['walkthroughs', 'children', parentId],
        queryFn: () => WalkthroughsService.getAll({ parentId, $sort: { createdAt: 1 } }),
        enabled: !!parentId,
    });
};

export const useDeleteWalkthrough = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: WalkthroughsService.delete,
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['walkthroughs'] }),
                queryClient.invalidateQueries({ queryKey: ['walkthroughs', 'project'] }),
                queryClient.invalidateQueries({ queryKey: ['walkthroughs', 'children'] }),
                queryClient.refetchQueries({ queryKey: ['walkthroughs'], type: 'active' })
            ]);
        },
    });
};
