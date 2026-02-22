import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { WalkthroughVersionsService, PaginatedVersions, WalkthroughVersion } from '../services/walkthrough-versions.service';

const VERSIONS_PAGE_SIZE = 5;

export const useWalkthroughVersions = (walkthroughId: string) => {
    return useInfiniteQuery<PaginatedVersions>({
        queryKey: ['walkthrough-versions', walkthroughId],
        queryFn: ({ pageParam = 0 }) =>
            WalkthroughVersionsService.getVersions(walkthroughId, VERSIONS_PAGE_SIZE, pageParam as number),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => {
            const nextSkip = lastPage.skip + lastPage.limit;
            return nextSkip < lastPage.total ? nextSkip : undefined;
        },
        enabled: !!walkthroughId,
    });
};

export const useRestoreVersion = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ walkthroughId, versionId }: { walkthroughId: string; versionId: string }) =>
            WalkthroughVersionsService.restoreVersion(walkthroughId, versionId),
        onSuccess: async (_, variables) => {
            // Reset infinite query pages and refetch from scratch so the new version appears at the top
            queryClient.removeQueries({ queryKey: ['walkthrough-versions', variables.walkthroughId] });
            await Promise.all([
                queryClient.refetchQueries({ queryKey: ['walkthroughs', variables.walkthroughId] }),
                queryClient.invalidateQueries({ queryKey: ['walkthrough-versions', variables.walkthroughId] }),
            ]);
        }
    });
};

export const useUpdateVersion = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ versionId, data }: { versionId: string; data: Partial<WalkthroughVersion> }) =>
            WalkthroughVersionsService.updateVersion(versionId, data),
        onSuccess: async (updatedVersion) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['walkthrough-versions', updatedVersion.walkthroughId] }),
                queryClient.invalidateQueries({ queryKey: ['walkthroughs', updatedVersion.walkthroughId] }),
            ]);
        }
    });
};
