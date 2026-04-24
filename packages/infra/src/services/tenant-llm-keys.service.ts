import { httpClient } from '../http/client';

export type TenantLlmProvider = 'google' | 'groq' | 'openai' | 'anthropic';

export interface TenantLlmKey {
    id: string;
    organizationId?: string | null;
    projectId?: string | null;
    provider: TenantLlmProvider;
    modelId: string;
    encryptedApiKey?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateTenantLlmKeyInput {
    organizationId?: string;
    projectId?: string;
    provider: TenantLlmProvider;
    modelId: string;
    apiKey: string;
}

export interface UpdateTenantLlmKeyInput {
    modelId?: string;
    apiKey?: string;
    isActive?: boolean;
}

export const TenantLlmKeysService = {
    async getAll(query?: Record<string, any>): Promise<{ data: TenantLlmKey[]; total: number; limit: number; skip: number } | TenantLlmKey[]> {
        const { data } = await httpClient.get('/tenant-llm-keys', { params: query });
        return data;
    },

    async create(input: CreateTenantLlmKeyInput): Promise<TenantLlmKey> {
        const { data } = await httpClient.post('/tenant-llm-keys', input);
        return data;
    },

    async update(id: string, input: UpdateTenantLlmKeyInput): Promise<TenantLlmKey> {
        const { data } = await httpClient.patch(`/tenant-llm-keys/${id}`, input);
        return data;
    },

    async remove(id: string): Promise<void> {
        await httpClient.delete(`/tenant-llm-keys/${id}`);
    },
};
