import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProjectInvitationsService } from '../services/project-invitations.service';

export const useProjectInvitations = (projectId: string) => {
    return useQuery({
        queryKey: ['project-invitations', projectId],
        queryFn: () => ProjectInvitationsService.getByProject(projectId),
        enabled: !!projectId,
    });
};

export const useCreateInvitation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: { projectId: string; email: string; role: string }) =>
            ProjectInvitationsService.create(payload),
        onSuccess: async (data, variables) => {
            const projectId = data.projectId || variables.projectId;
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['project-invitations', projectId] }),
                queryClient.refetchQueries({ queryKey: ['project-invitations', projectId] }),
            ]);
        },
    });
};

export const useRevokeInvitation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, projectId }: { id: string; projectId: string }) =>
            ProjectInvitationsService.remove(id),
        onSuccess: async (_, variables) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['project-invitations', variables.projectId] }),
                queryClient.refetchQueries({ queryKey: ['project-invitations', variables.projectId] }),
            ]);
        },
    });
};

export const useInvitationByToken = (token: string) => {
    return useQuery({
        queryKey: ['invitation', token],
        queryFn: () => ProjectInvitationsService.getByToken(token),
        enabled: !!token,
        retry: false,
    });
};

export const useAcceptInvitation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (token: string) => ProjectInvitationsService.accept(token),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['projects'] }),
                queryClient.invalidateQueries({ queryKey: ['notifications'] }),
            ]);
        },
    });
};

export const useRejectInvitation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (token: string) => ProjectInvitationsService.reject(token),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
};

