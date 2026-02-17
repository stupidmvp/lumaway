import { httpClient } from '../http/client';

export interface UserProfile {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    avatar?: string | null;
    status?: 'active' | 'inactive' | 'suspended';
    createdAt?: string;
    organization?: string | null;
    organizationRole?: string | null;
    sharedProjects?: {
        id: string;
        name: string;
        role: string;
    }[];
}

export const UserProfilesService = {
    async get(id: string): Promise<UserProfile> {
        const { data } = await httpClient.get<UserProfile>(`/user-profiles/${id}`);
        return data;
    },
};

