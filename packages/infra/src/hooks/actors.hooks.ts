import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ActorsService, Actor } from '../services/actors.service';

export const useActors = (projectId?: string) => {
    return useQuery({
        queryKey: ['actors', projectId],
        queryFn: () => ActorsService.getByProject(projectId!),
        enabled: !!projectId,
    });
};

export const useActor = (id?: string) => {
    return useQuery({
        queryKey: ['actors', 'detail', id],
        queryFn: () => ActorsService.getById(id!),
        enabled: !!id,
    });
};

export const useCreateActor = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Partial<Actor>) => ActorsService.create(data),
        onSuccess: async (created) => {
            await queryClient.invalidateQueries({ queryKey: ['actors', created.projectId] });
        },
    });
};

export const useUpdateActor = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Actor> }) =>
            ActorsService.update(id, data),
        onSuccess: async (updated) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['actors', updated.projectId] }),
                queryClient.invalidateQueries({ queryKey: ['actors', 'detail', updated.id] }),
            ]);
        },
    });
};

export const useDeleteActor = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => ActorsService.delete(id),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['actors'] });
        },
    });
};

