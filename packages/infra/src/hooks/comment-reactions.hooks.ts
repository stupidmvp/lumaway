import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CommentReactionsService, type ToggleReactionData } from '../services/comment-reactions.service';

/**
 * Mutation hook to toggle a reaction on a comment.
 * Invalidates comment queries so the updated reactions appear.
 */
export const useToggleReaction = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: ToggleReactionData) => CommentReactionsService.toggle(data),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['comments'] });
        },
    });
};

/**
 * Mutation hook to remove a reaction by ID.
 */
export const useRemoveReaction = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => CommentReactionsService.remove(id),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['comments'] });
        },
    });
};

