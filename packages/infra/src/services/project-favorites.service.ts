import { httpClient } from '../http/client';

export interface ProjectFavorite {
    id: string;
    projectId: string;
    userId: string;
    createdAt: string;
}

export const ProjectFavoritesService = {
    async getAll(query?: Record<string, any>): Promise<{ data: ProjectFavorite[], total: number }> {
        const { data } = await httpClient.get<any>('/project-favorites', { params: query });
        return data;
    },

    async create(projectId: string): Promise<ProjectFavorite> {
        const { data } = await httpClient.post<ProjectFavorite>('/project-favorites', { projectId });
        return data;
    },

    async remove(id: string): Promise<void> {
        await httpClient.delete(`/project-favorites/${id}`);
    },
};

