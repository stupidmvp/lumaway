import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiKeysService } from '../services/api-keys.service';

export const useApiKeys = (projectId?: string) => {
    return useQuery({
        queryKey: ['api-keys', projectId],
        queryFn: () => {
            const query: Record<string, any> = {
                $sort: { createdAt: -1 }
            };
            if (projectId) query.projectId = projectId;
            return ApiKeysService.getAll(query);
        },
        enabled: !!projectId,
    });
};

export const useCreateApiKey = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ projectId, name }: { projectId: string; name?: string }) =>
            ApiKeysService.create(projectId, name),
        onSuccess: async (_, { projectId }) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['api-keys', projectId] }),
                queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
                queryClient.refetchQueries({ queryKey: ['api-keys'], type: 'active' })
            ]);
        },
    });
};

export const useUpdateApiKey = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) =>
            ApiKeysService.update(id, name),
        onSuccess: async (data) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['api-keys', data.projectId] }),
                queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
                queryClient.refetchQueries({ queryKey: ['api-keys'], type: 'active' })
            ]);
        },
    });
};

export const useDeleteApiKey = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => ApiKeysService.remove(id),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
                queryClient.refetchQueries({ queryKey: ['api-keys'], type: 'active' })
            ]);
        },
    });
};
