import { httpClient } from '../http/client';

// ── Project Settings Types ───────────────────────────────────────────────

export interface ProjectSettings {
    // General
    description?: string;

    // LumaWay Mode
    mode?: 'guided' | 'self-serve' | 'hybrid';

    // Assistant / Chatbot
    assistantEnabled?: boolean;
    defaultLocale?: string;
    supportedLocales?: string[];
    assistantName?: string;
    assistantWelcomeMessage?: string;
    assistantSystemPrompt?: string;
    chatbotEnabled?: boolean;
    chatbotUi?: {
        template?: 'default' | 'compact' | 'minimal';
        position?: 'bottom-right' | 'bottom-left';
        primaryColor?: string;
        secondaryColor?: string;
        surfaceColor?: string;
        chatWidth?: number;
        chatHeight?: number;
        triggerSize?: number;
    };
    observerMode?: {
        enabled?: boolean;
        allowedDomains?: string[];
        captureAudio?: boolean;
        requireHumanApproval?: boolean;
        retentionDays?: number;
    };

    // Security
    requireApiKey?: boolean;
    allowPublicAccess?: boolean;
    allowedDomains?: string[];
    ipWhitelist?: string[];

    // Member Permissions
    editorCanPublish?: boolean;
    editorCanDelete?: boolean;
    editorCanInvite?: boolean;
    viewerCanComment?: boolean;
    viewerCanExport?: boolean;

    // Approval Workflow
    approvalRequired?: boolean;
    minApprovals?: number;
    reviewerUserIds?: string[];

    // Notifications — project lifecycle
    notifyOnPublish?: boolean;
    notifyOnNewMember?: boolean;
    notifyOnWalkthroughUpdate?: boolean;

    // Notifications — comment activity (project-level gates)
    notifyOnMention?: boolean;
    notifyOnReply?: boolean;
    notifyOnReaction?: boolean;
    notifyOnCorrection?: boolean;
    notifyOnResolved?: boolean;
    notifyOnAnnouncement?: boolean;
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
    description: '',
    mode: 'guided',
    assistantEnabled: false,
    defaultLocale: 'en',
    supportedLocales: ['en'],
    assistantName: 'LumaWay Assistant',
    assistantWelcomeMessage: 'Hi! How can I help you today?',
    assistantSystemPrompt: undefined,
    chatbotEnabled: false,
    chatbotUi: {
        template: 'default',
        position: 'bottom-right',
        primaryColor: '#4f46e5',
        secondaryColor: '#9333ea',
        surfaceColor: '#ffffff',
        chatWidth: 380,
        chatHeight: 520,
        triggerSize: 64,
    },
    observerMode: {
        enabled: false,
        allowedDomains: [],
        captureAudio: false,
        requireHumanApproval: true,
        retentionDays: 90,
    },
    requireApiKey: true,
    allowPublicAccess: false,
    allowedDomains: [],
    ipWhitelist: [],
    editorCanPublish: true,
    editorCanDelete: false,
    editorCanInvite: true,
    viewerCanComment: true,
    viewerCanExport: true,
    approvalRequired: false,
    minApprovals: 1,
    reviewerUserIds: [],
    notifyOnPublish: true,
    notifyOnNewMember: true,
    notifyOnWalkthroughUpdate: false,
    notifyOnMention: true,
    notifyOnReply: true,
    notifyOnReaction: true,
    notifyOnCorrection: true,
    notifyOnResolved: true,
    notifyOnAnnouncement: true,
};

// ── Project Interface ────────────────────────────────────────────────────

export interface ProjectMemberPreview {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
}

export interface Project {
    id: string;
    name: string;
    logo?: string | null;
    organizationId: string;
    ownerId?: string;
    owner?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        avatar?: string;
    };
    walkthroughsCount?: number;
    membersCount?: number;
    members?: ProjectMemberPreview[];
    isFavorite?: boolean;
    status?: 'active' | 'archived';
    settings?: ProjectSettings;
    createdAt: string;
}

export const ProjectsService = {
    async getAll(query?: Record<string, any>): Promise<{ data: Project[], total: number, limit: number, skip: number } | Project[]> {
        const { data } = await httpClient.get<any>('/projects', { params: query });
        return data;
    },

    async create(name: string): Promise<Project> {
        const { data } = await httpClient.post<Project>('/projects', { name });
        return data;
    },

    async getById(id: string): Promise<Project> {
        const { data } = await httpClient.get<Project>(`/projects/${id}`);
        return data;
    },

    async update(id: string, data: Partial<Project>): Promise<Project> {
        const { data: result } = await httpClient.patch<Project>(`/projects/${id}`, data);
        return result;
    },

    async updateSettings(id: string, settings: Partial<ProjectSettings>): Promise<Project> {
        const { data } = await httpClient.patch<Project>(`/project-settings/${id}`, { settings });
        return data;
    },

    async delete(id: string): Promise<void> {
        await httpClient.delete(`/projects/${id}`);
    }
};
