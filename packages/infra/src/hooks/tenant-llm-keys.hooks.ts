import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TenantLlmKeysService, type CreateTenantLlmKeyInput, type UpdateTenantLlmKeyInput } from '../services/tenant-llm-keys.service';

export const useTenantLlmKeys = (projectId?: string) => {
    return useQuery({
        queryKey: ['tenant-llm-keys', projectId],
        queryFn: () => {
            const query: Record<string, any> = { $sort: { createdAt: -1 } };
            if (projectId) query.projectId = projectId;
            return TenantLlmKeysService.getAll(query);
        },
        enabled: Boolean(projectId),
    });
};

export const useCreateTenantLlmKey = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateTenantLlmKeyInput) => TenantLlmKeysService.create(input),
        onSuccess: async (data) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['tenant-llm-keys', data.projectId] }),
                queryClient.invalidateQueries({ queryKey: ['tenant-llm-keys'] }),
            ]);
        },
    });
};

export const useUpdateTenantLlmKey = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateTenantLlmKeyInput }) =>
            TenantLlmKeysService.update(id, input),
        onSuccess: async (data) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['tenant-llm-keys', data.projectId] }),
                queryClient.invalidateQueries({ queryKey: ['tenant-llm-keys'] }),
            ]);
        },
    });
};
