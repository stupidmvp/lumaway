import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LumensService } from '../services/lumens.service';

export const useLumens = (projectId?: string, limit: number = 20) => {
    return useQuery({
        queryKey: ['lumens', projectId, limit],
        queryFn: () => LumensService.getAllByProject(projectId!, limit),
        enabled: Boolean(projectId),
    });
};

export const useLumenReview = (observerSessionId?: string) => {
    return useQuery({
        queryKey: ['lumens', 'review', observerSessionId],
        queryFn: () => LumensService.getReview(observerSessionId!),
        enabled: Boolean(observerSessionId),
    });
};

export const useGenerateWalkthroughsFromLumen = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ observerSessionId, mode, baseTitle }: { observerSessionId: string; mode?: 'single' | 'perChapter'; baseTitle?: string }) =>
            LumensService.generateWalkthroughs(observerSessionId, { mode, baseTitle }),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['walkthroughs'] }),
                queryClient.invalidateQueries({ queryKey: ['lumens'] }),
            ]);
        },
    });
};

export const useReprocessLumen = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ observerSessionId }: { observerSessionId: string }) =>
            LumensService.reprocess(observerSessionId),
        onSuccess: async (_, { observerSessionId }) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['lumens'] }),
                queryClient.invalidateQueries({ queryKey: ['lumens', 'review', observerSessionId] }),
            ]);
        },
    });
};
