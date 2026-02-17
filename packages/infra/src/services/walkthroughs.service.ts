import { httpClient } from '../http/client';

export interface Step {
    id: string;
    title: string;
    content: string;
    target?: string;
    placement?: 'auto' | 'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end' | 'right' | 'right-start' | 'right-end';
}

export interface WalkthroughActorEmbed {
    id: string;
    name: string;
    slug: string;
    description?: string;
    color?: string;
}

export interface Walkthrough {
    id: string;
    title: string;
    description?: string | null; // Plain text summary — used for AI context
    content?: Record<string, any> | null; // Lexical editor state JSON
    projectId: string;
    parentId?: string | null;
    previousWalkthroughId?: string | null;
    nextWalkthroughId?: string | null;
    steps: Step[];
    tags: string[];
    actors?: WalkthroughActorEmbed[];
    isPublished: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export const WalkthroughsService = {
    async getAll(query?: Record<string, any>): Promise<{ data: Walkthrough[], total: number, limit: number, skip: number } | Walkthrough[]> {
        const { data } = await httpClient.get<any>('/walkthroughs', { params: query });
        return data;
    },

    async getById(id: string): Promise<Walkthrough> {
        const { data } = await httpClient.get<Walkthrough>(`/walkthroughs/${id}`);
        return data;
    },

    async getByProject(projectId: string): Promise<Walkthrough[]> {
        const { data } = await httpClient.get<Walkthrough[]>(`/walkthroughs?projectId=${projectId}`);
        return data;
    },

    async create(data: Partial<Walkthrough>): Promise<Walkthrough> {
        const { data: created } = await httpClient.post<Walkthrough>('/walkthroughs', data);
        return created;
    },

    async update(id: string, data: Partial<Walkthrough>): Promise<Walkthrough> {
        const { data: updated } = await httpClient.patch<Walkthrough>(`/walkthroughs/${id}`, data);
        return updated;
    },

    async delete(id: string): Promise<void> {
        await httpClient.delete(`/walkthroughs/${id}`);
    }
};
