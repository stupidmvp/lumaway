import { httpClient } from '../http/client';

export interface ProjectMember {
    id: string;
    projectId: string;
    userId: string;
    role: 'owner' | 'editor' | 'viewer';
    createdAt: string;
    user?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        avatar?: string;
    };
}

export const ProjectMembersService = {
    async getAll(query: Record<string, any>): Promise<{ data: ProjectMember[]; total: number; limit: number; skip: number }> {
        const { data } = await httpClient.get<any>('/project-members', { params: query });
        // Normalize: API returns { data, total } with $limit, or plain array without
        if (Array.isArray(data)) {
            return { data, total: data.length, limit: query.$limit || data.length, skip: query.$skip || 0 };
        }
        return data;
    },

    async updateRole(id: string, role: string): Promise<ProjectMember> {
        const { data } = await httpClient.patch<ProjectMember>(`/project-members/${id}`, { role });
        return data;
    },

    async remove(id: string): Promise<void> {
        await httpClient.delete(`/project-members/${id}`);
    },
};

