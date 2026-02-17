import { httpClient } from '../http/client';

// =====================================================
// Types
// =====================================================

export type CommentTargetType = 'project' | 'walkthrough' | 'walkthrough_step';
export type CommentType = 'comment' | 'correction' | 'announcement';
export type CommentStatus = 'active' | 'archived' | 'deleted';

export interface CommentAttachment {
    id: string;
    commentId: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    s3Key: string;
    uploadedBy: string;
    createdAt: string;
}

export interface CommentMention {
    id: string;
    mentionedUserId: string;
    user?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        avatar?: string;
    };
}

export interface Comment {
    id: string;
    projectId: string;
    targetType: CommentTargetType;
    targetId?: string;
    stepId?: string;
    userId: string;
    content: string;
    type: CommentType;
    parentId?: string;
    status: CommentStatus;
    isEdited: boolean;
    isResolved: boolean;
    archivedAt?: string;
    archivedBy?: string;
    deletedAt?: string;
    deletedBy?: string;
    createdAt: string;
    updatedAt: string;
    user?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        avatar?: string;
    };
    attachments?: CommentAttachment[];
    mentions?: CommentMention[];
    reactions?: CommentReactionSummary[];
    /** Resolved step info — populated by the API from walkthrough steps JSON */
    stepInfo?: {
        title: string;
        index: number;
        walkthroughTitle: string;
    };
}

export interface CommentReactionSummary {
    id: string;
    userId: string;
    emoji: string;
    createdAt: string;
    user?: {
        id: string;
        firstName: string;
        lastName: string;
        avatar?: string;
    };
}

export interface CreateCommentData {
    projectId: string;
    targetType?: CommentTargetType;
    targetId?: string;
    stepId?: string;
    content: string;
    type?: CommentType;
    parentId?: string;
    attachments?: {
        fileName: string;
        fileType: string;
        fileSize: number;
        s3Key: string;
    }[];
}

export interface PatchCommentData {
    content?: string;
    status?: CommentStatus;
    isResolved?: boolean;
    removeAttachmentIds?: string[];
}

export interface CommentsListResponse {
    data: Comment[];
    total: number;
    limit: number;
    skip: number;
}

// =====================================================
// Service
// =====================================================

export const CommentsService = {
    /**
     * Fetch comments with optional filters.
     * Always requires `projectId` in the query.
     */
    async getAll(query: Record<string, any>): Promise<CommentsListResponse> {
        const { data } = await httpClient.get<any>('/comments', { params: query });
        if (Array.isArray(data)) {
            return { data, total: data.length, limit: data.length, skip: 0 };
        }
        return data;
    },

    /**
     * Fetch a single comment by ID.
     */
    async getById(id: string): Promise<Comment> {
        const { data } = await httpClient.get<Comment>(`/comments/${id}`);
        return data;
    },

    /**
     * Get project-level activity feed.
     */
    async getProjectFeed(projectId: string, options?: { limit?: number; skip?: number }): Promise<CommentsListResponse> {
        return this.getAll({
            projectId,
            $sort: { createdAt: '-1' },
            $limit: options?.limit ?? 50,
            $skip: options?.skip ?? 0,
        });
    },

    /**
     * Get comments for a specific walkthrough (walkthrough-level only).
     */
    async getByWalkthrough(projectId: string, walkthroughId: string): Promise<CommentsListResponse> {
        return this.getAll({
            projectId,
            targetType: 'walkthrough',
            targetId: walkthroughId,
            $sort: { createdAt: '1' },
            $limit: 500,
        });
    },

    /**
     * Get ALL comments associated with a walkthrough (both walkthrough-level and step-level).
     * This gives a complete view of the discussion across all steps.
     */
    async getAllByWalkthrough(projectId: string, walkthroughId: string): Promise<CommentsListResponse> {
        return this.getAll({
            projectId,
            targetId: walkthroughId,
            $sort: { createdAt: '1' },
            $limit: 500,
        });
    },

    /**
     * Get comments for a specific step within a walkthrough.
     */
    async getByWalkthroughStep(projectId: string, walkthroughId: string, stepId: string): Promise<CommentsListResponse> {
        return this.getAll({
            projectId,
            targetType: 'walkthrough_step',
            targetId: walkthroughId,
            stepId,
            $sort: { createdAt: '1' },
            $limit: 500,
        });
    },

    /**
     * Get unresolved corrections for a project.
     */
    async getUnresolvedCorrections(projectId: string): Promise<CommentsListResponse> {
        return this.getAll({
            projectId,
            type: 'correction',
            isResolved: false,
            $sort: { createdAt: '-1' },
        });
    },

    /**
     * Get archived comments for a project.
     */
    async getArchived(projectId: string): Promise<CommentsListResponse> {
        return this.getAll({
            projectId,
            status: 'archived',
            $sort: { createdAt: '-1' },
        });
    },

    /**
     * Get replies to a specific comment.
     */
    async getReplies(projectId: string, parentId: string): Promise<CommentsListResponse> {
        return this.getAll({
            projectId,
            parentId,
            $sort: { createdAt: '1' },
        });
    },

    /**
     * Create a new comment.
     */
    async create(data: CreateCommentData): Promise<Comment> {
        const { data: created } = await httpClient.post<Comment>('/comments', data);
        return created;
    },

    /**
     * Update a comment (edit content, resolve, archive, soft-delete).
     */
    async update(id: string, data: PatchCommentData): Promise<Comment> {
        const { data: updated } = await httpClient.patch<Comment>(`/comments/${id}`, data);
        return updated;
    },

    /**
     * Archive a comment (and its replies).
     */
    async archive(id: string): Promise<Comment> {
        return this.update(id, { status: 'archived' });
    },

    /**
     * Soft-delete a comment.
     */
    async softDelete(id: string): Promise<Comment> {
        return this.update(id, { status: 'deleted' });
    },

    /**
     * Restore an archived or deleted comment.
     */
    async restore(id: string): Promise<Comment> {
        return this.update(id, { status: 'active' });
    },

    /**
     * Mark a correction as resolved.
     */
    async resolveCorrection(id: string): Promise<Comment> {
        return this.update(id, { isResolved: true });
    },

    /**
     * Remove specific attachments from a comment.
     */
    async removeAttachments(commentId: string, attachmentIds: string[]): Promise<Comment> {
        return this.update(commentId, { removeAttachmentIds: attachmentIds });
    },

    /**
     * Hard delete (only if needed, normally use softDelete).
     */
    async remove(id: string): Promise<void> {
        await httpClient.delete(`/comments/${id}`);
    },
};

