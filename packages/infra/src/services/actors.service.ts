import { httpClient } from '../http/client';

export interface Actor {
    id: string;
    projectId: string;
    name: string;
    slug: string;
    description?: string;
    color?: string;
    createdAt: string;
    updatedAt: string;
}

export const ActorsService = {
    async getAll(query?: Record<string, any>): Promise<{ data: Actor[], total: number, limit: number, skip: number } | Actor[]> {
        const { data } = await httpClient.get<any>('/actors', { params: query });
        return data;
    },

    async getById(id: string): Promise<Actor> {
        const { data } = await httpClient.get<Actor>(`/actors/${id}`);
        return data;
    },

    async getByProject(projectId: string): Promise<Actor[]> {
        const { data } = await httpClient.get<any>('/actors', { params: { projectId } });
        // Handle paginated or array response
        return Array.isArray(data) ? data : data?.data || [];
    },

    async create(data: Partial<Actor>): Promise<Actor> {
        const { data: created } = await httpClient.post<Actor>('/actors', data);
        return created;
    },

    async update(id: string, data: Partial<Actor>): Promise<Actor> {
        const { data: updated } = await httpClient.patch<Actor>(`/actors/${id}`, data);
        return updated;
    },

    async delete(id: string): Promise<void> {
        await httpClient.delete(`/actors/${id}`);
    }
};

