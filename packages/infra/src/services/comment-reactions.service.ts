import { httpClient } from '../http/client';

// =====================================================
// Types
// =====================================================

export interface CommentReaction {
    id: string;
    commentId: string;
    userId: string;
    emoji: string;
    createdAt: string;
    user?: {
        id: string;
        firstName: string;
        lastName: string;
        avatar?: string;
    };
    /** Set by the toggle endpoint when a reaction was removed instead of created */
    _toggled?: 'removed';
}

export interface ToggleReactionData {
    commentId: string;
    emoji: string;
}

// =====================================================
// Service
// =====================================================

export const CommentReactionsService = {
    /**
     * Toggle a reaction on a comment.
     * If the user already reacted with this emoji, it's removed.
     * Otherwise, it's created.
     */
    async toggle(data: ToggleReactionData): Promise<CommentReaction> {
        const { data: result } = await httpClient.post<CommentReaction>('/comment-reactions', data);
        return result;
    },

    /**
     * Remove a specific reaction by ID.
     */
    async remove(id: string): Promise<void> {
        await httpClient.delete(`/comment-reactions/${id}`);
    },
};

