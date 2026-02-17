import { httpClient } from '../http/client';

export interface ApiKey {
    id: string;
    key: string;
    name: string;
    projectId: string;
    createdAt: string;
}

export const ApiKeysService = {
    async create(projectId: string, name?: string): Promise<ApiKey> {
        const { data } = await httpClient.post<ApiKey>('/api-keys', { projectId, name });
        return data;
    },

    async update(id: string, name: string): Promise<ApiKey> {
        const { data } = await httpClient.patch<ApiKey>(`/api-keys/${id}`, { name });
        return data;
    },

    async getAll(query?: Record<string, any>): Promise<{ data: ApiKey[], total: number, limit: number, skip: number } | ApiKey[]> {
        const { data } = await httpClient.get<any>('/api-keys', { params: query });
        if (Array.isArray(data)) {
            return data.map(item => ({ ...item, id: item.id || item.key }));
        }
        if (data && Array.isArray(data.data)) {
            return {
                ...data,
                data: data.data.map((item: any) => ({ ...item, id: item.id || item.key }))
            };
        }
        return data;
    },

    async remove(id: string): Promise<void> {
        await httpClient.delete(`/api-keys/${id}`);
    }
};
