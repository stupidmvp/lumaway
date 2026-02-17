import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { CommentsService, type CreateCommentData, type PatchCommentData } from '../services/comments.service';

/**
 * Hook to fetch project-level activity feed.
 */
export const useProjectComments = (projectId?: string, options?: { limit?: number; skip?: number }) => {
    return useQuery({
        queryKey: ['comments', 'project-feed', projectId, options?.limit, options?.skip],
        queryFn: () => CommentsService.getProjectFeed(projectId!, options),
        enabled: !!projectId,
        placeholderData: keepPreviousData,
    });
};

/**
 * Hook to fetch comments for a specific walkthrough (walkthrough-level only).
 */
export const useWalkthroughComments = (projectId?: string, walkthroughId?: string) => {
    return useQuery({
        queryKey: ['comments', 'walkthrough', projectId, walkthroughId],
        queryFn: () => CommentsService.getByWalkthrough(projectId!, walkthroughId!),
        enabled: !!projectId && !!walkthroughId,
    });
};

/**
 * Hook to fetch ALL comments for a walkthrough (both walkthrough-level and step-level).
 * This provides a complete view of the discussion across all steps.
 */
export const useAllWalkthroughComments = (projectId?: string, walkthroughId?: string) => {
    return useQuery({
        queryKey: ['comments', 'walkthrough-all', projectId, walkthroughId],
        queryFn: () => CommentsService.getAllByWalkthrough(projectId!, walkthroughId!),
        enabled: !!projectId && !!walkthroughId,
    });
};

/**
 * Hook to fetch comments for a specific step within a walkthrough.
 */
export const useWalkthroughStepComments = (projectId?: string, walkthroughId?: string, stepId?: string) => {
    return useQuery({
        queryKey: ['comments', 'walkthrough-step', projectId, walkthroughId, stepId],
        queryFn: () => CommentsService.getByWalkthroughStep(projectId!, walkthroughId!, stepId!),
        enabled: !!projectId && !!walkthroughId && !!stepId,
    });
};

/**
 * Hook to fetch unresolved corrections for a project.
 */
export const useUnresolvedCorrections = (projectId?: string) => {
    return useQuery({
        queryKey: ['comments', 'corrections', projectId],
        queryFn: () => CommentsService.getUnresolvedCorrections(projectId!),
        enabled: !!projectId,
    });
};

/**
 * Hook to fetch archived comments for a project.
 */
export const useArchivedComments = (projectId?: string) => {
    return useQuery({
        queryKey: ['comments', 'archived', projectId],
        queryFn: () => CommentsService.getArchived(projectId!),
        enabled: !!projectId,
    });
};

/**
 * Hook to fetch replies to a specific comment.
 */
export const useCommentReplies = (projectId?: string, parentId?: string) => {
    return useQuery({
        queryKey: ['comments', 'replies', projectId, parentId],
        queryFn: () => CommentsService.getReplies(projectId!, parentId!),
        enabled: !!projectId && !!parentId,
    });
};

/**
 * Hook to fetch comments with custom query parameters.
 */
export const useComments = (query?: Record<string, any>) => {
    return useQuery({
        queryKey: ['comments', query],
        queryFn: () => CommentsService.getAll(query!),
        enabled: !!query?.projectId,
        placeholderData: keepPreviousData,
    });
};

/**
 * Mutation hook to create a comment.
 */
export const useCreateComment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateCommentData) => CommentsService.create(data),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['comments'] });
        },
    });
};

/**
 * Mutation hook to update a comment (edit content, resolve, archive, delete).
 */
export const useUpdateComment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: PatchCommentData }) =>
            CommentsService.update(id, data),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['comments'] });
        },
    });
};

/**
 * Mutation hook to archive a comment.
 */
export const useArchiveComment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => CommentsService.archive(id),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['comments'] });
        },
    });
};

/**
 * Mutation hook to soft-delete a comment.
 */
export const useSoftDeleteComment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => CommentsService.softDelete(id),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['comments'] });
        },
    });
};

/**
 * Mutation hook to restore a comment.
 */
export const useRestoreComment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => CommentsService.restore(id),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['comments'] });
        },
    });
};

/**
 * Mutation hook to resolve a correction.
 */
export const useResolveCorrection = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => CommentsService.resolveCorrection(id),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['comments'] });
        },
    });
};

/**
 * Mutation hook to remove attachments from a comment.
 */
export const useRemoveAttachments = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ commentId, attachmentIds }: { commentId: string; attachmentIds: string[] }) =>
            CommentsService.removeAttachments(commentId, attachmentIds),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['comments'] });
        },
    });
};
