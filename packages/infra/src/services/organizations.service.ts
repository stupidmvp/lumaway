import { httpClient } from '../http/client';

export interface Organization {
    id: string;
    name: string;
    slug: string;
    logo?: string | null;
    role?: 'owner' | 'admin' | 'member';
    createdAt?: string;
    updatedAt?: string;
}

export interface OrganizationMembership {
    id: string;
    name: string;
    slug: string;
    logo?: string | null;
    role: 'owner' | 'admin' | 'member';
    membershipId: string;
}

export interface OrganizationMember {
    id: string;
    userId: string;
    role: 'owner' | 'admin' | 'member';
    createdAt: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    avatar?: string | null;
}

export interface UpdateOrganizationData {
    name?: string;
    slug?: string;
    logo?: string | null;
}

export interface CreateOrganizationData {
    name: string;
    slug: string;
}

export const OrganizationsService = {
    async getMyOrganization(): Promise<Organization | null> {
        const { data } = await httpClient.get<Organization | null>('/me-organization');
        return data;
    },

    async getMyOrganizations(): Promise<{ data: OrganizationMembership[]; total: number }> {
        const { data } = await httpClient.get<{ data: OrganizationMembership[]; total: number }>('/me-organizations');
        return data;
    },

    async createOrganization(payload: CreateOrganizationData): Promise<Organization> {
        const { data } = await httpClient.post<Organization>('/user-organizations', payload);
        return data;
    },

    async updateMyOrganization(data: UpdateOrganizationData): Promise<Organization> {
        const { data: result } = await httpClient.patch<Organization>('/me-organization/current', data);
        return result;
    },

    async deleteOrganization(orgId: string): Promise<void> {
        await httpClient.delete(`/user-organizations/${orgId}`);
    },

    async leaveOrganization(orgId: string): Promise<void> {
        await httpClient.post('/user-organization-leave', { organizationId: orgId });
    },

    async getOrganizationMembers(orgId: string): Promise<{ data: OrganizationMember[]; total: number }> {
        const { data } = await httpClient.get<{ data: OrganizationMember[]; total: number }>(`/org-members?orgId=${orgId}`);
        return data;
    },

    async updateOrganizationMemberRole(memberId: string, role: string): Promise<OrganizationMember> {
        const { data } = await httpClient.patch<OrganizationMember>(`/org-members/${memberId}`, { role });
        return data;
    },

    async removeOrganizationMember(memberId: string): Promise<void> {
        await httpClient.delete(`/org-members/${memberId}`);
    },
};
