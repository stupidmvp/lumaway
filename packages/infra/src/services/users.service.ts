import { httpClient } from '../http/client';

export interface UserOrgMembership {
    organizationId: string;
    role: 'owner' | 'admin' | 'member';
    organization?: {
        id: string;
        name: string;
        slug: string;
        logo: string | null;
    };
}

export interface UserProjectMembership {
    projectId: string;
    role: 'owner' | 'editor' | 'viewer';
}

export interface UserPreferences {
    // Appearance
    theme?: 'light' | 'dark' | 'system';
    language?: 'en' | 'es';

    // General
    defaultHomePage?: 'projects' | 'walkthroughs';
    displayNames?: 'fullName' | 'firstName' | 'email';
    firstDayOfWeek?: 'monday' | 'sunday';

    // Notifications — master toggle
    emailNotifications?: boolean;
    notifyOnInvitation?: boolean;
    notifyOnMemberJoin?: boolean;

    // Notifications — per-type email controls
    emailOnMention?: boolean;
    emailOnReply?: boolean;
    emailOnReaction?: boolean;
    emailOnCorrection?: boolean;
    emailOnResolved?: boolean;
    emailOnAnnouncement?: boolean;

    // Editor
    editorSidebarOpen?: boolean;
    defaultStepPlacement?: 'auto' | 'top' | 'bottom' | 'left' | 'right';

    // Onboarding
    onboardingCompleted?: boolean;
}

export const DEFAULT_PREFERENCES: Required<UserPreferences> = {
    theme: 'system',
    language: 'en',
    defaultHomePage: 'projects',
    displayNames: 'fullName',
    firstDayOfWeek: 'monday',
    emailNotifications: true,
    notifyOnInvitation: true,
    notifyOnMemberJoin: true,
    emailOnMention: true,
    emailOnReply: true,
    emailOnReaction: false,       // Reactions are noisy — email OFF by default
    emailOnCorrection: true,
    emailOnResolved: true,
    emailOnAnnouncement: true,
    editorSidebarOpen: true,
    defaultStepPlacement: 'bottom',
    onboardingCompleted: false,
};

export interface User {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    avatar?: string | null;
    status?: 'active' | 'inactive' | 'suspended';
    organizationId?: string | null;
    createdAt?: string;
    globalRoles?: string[];
    organizationMemberships?: UserOrgMembership[];
    projectMemberships?: UserProjectMembership[];
    preferences?: UserPreferences;
}

export interface UpdateProfileData {
    firstName?: string;
    lastName?: string;
    avatar?: string | null;
}

export const UsersService = {
    async getMe(): Promise<User> {
        const { data } = await httpClient.get<User>('/me');
        return data;
    },

    async updateMe(data: UpdateProfileData): Promise<User> {
        const { data: result } = await httpClient.patch<User>('/me/profile', data);
        return result;
    },

    async updatePreferences(preferences: Partial<UserPreferences>): Promise<User> {
        const { data } = await httpClient.patch<User>('/me/profile', { preferences });
        return data;
    },
};
