import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { WalkthroughActorsService } from '../services/walkthrough-actors.service';

export const useWalkthroughActors = (walkthroughId?: string) => {
    return useQuery({
        queryKey: ['walkthrough-actors', walkthroughId],
        queryFn: () => WalkthroughActorsService.getByWalkthrough(walkthroughId!),
        enabled: !!walkthroughId,
    });
};

export const useAssignActor = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ walkthroughId, actorId }: { walkthroughId: string; actorId: string }) =>
            WalkthroughActorsService.assign(walkthroughId, actorId),
        onSuccess: async (_, { walkthroughId }) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['walkthrough-actors', walkthroughId] }),
                queryClient.invalidateQueries({ queryKey: ['walkthroughs'] }),
            ]);
        },
    });
};

export const useUnassignActor = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ walkthroughId, actorId }: { walkthroughId: string; actorId: string }) =>
            WalkthroughActorsService.unassign(walkthroughId, actorId),
        onSuccess: async (_, { walkthroughId }) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['walkthrough-actors', walkthroughId] }),
                queryClient.invalidateQueries({ queryKey: ['walkthroughs'] }),
            ]);
        },
    });
};

