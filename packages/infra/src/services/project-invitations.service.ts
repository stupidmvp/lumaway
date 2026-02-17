import { httpClient } from '../http/client';

export interface ProjectInvitation {
    id: string;
    projectId: string;
    email: string;
    role: 'owner' | 'editor' | 'viewer';
    status: 'pending' | 'accepted' | 'rejected' | 'expired';
    token: string;
    invitedBy: string;
    expiresAt: string;
    createdAt: string;
    inviter?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        avatar?: string;
    };
    project?: {
        id: string;
        name: string;
    };
}

export interface InvitationPreview {
    id: string;
    email: string;
    role: string;
    status: string;
    project: { id: string; name: string } | null;
    inviter: { firstName: string; lastName: string; email: string; avatar?: string } | null;
    expiresAt: string;
}

export const ProjectInvitationsService = {
    async getByProject(projectId: string): Promise<{ data: ProjectInvitation[]; total: number }> {
        const { data } = await httpClient.get<any>('/project-invitations', {
            params: { projectId, $limit: 100, $sort: { createdAt: -1 } },
        });
        // Normalize: API returns { data, total } with $limit, or plain array without
        if (Array.isArray(data)) {
            return { data, total: data.length };
        }
        return data;
    },

    async create(payload: { projectId: string; email: string; role: string }): Promise<ProjectInvitation> {
        const { data } = await httpClient.post<ProjectInvitation>('/project-invitations', payload);
        return data;
    },

    async remove(id: string): Promise<void> {
        await httpClient.delete(`/project-invitations/${id}`);
    },

    // Token-based endpoints (public/auth)
    async getByToken(token: string): Promise<InvitationPreview> {
        const { data } = await httpClient.get<InvitationPreview>(`/invitation-details/${token}`);
        return data;
    },

    async accept(token: string): Promise<{ message: string; projectId: string; organizationId: string | null }> {
        const { data } = await httpClient.post<{ message: string; projectId: string; organizationId: string | null }>(`/invitation-accept/${token}`);
        return data;
    },

    async reject(token: string): Promise<{ message: string }> {
        const { data } = await httpClient.post<{ message: string }>(`/invitation-reject/${token}`);
        return data;
    },
};

