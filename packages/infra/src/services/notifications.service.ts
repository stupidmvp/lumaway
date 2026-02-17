import { httpClient } from '../http/client';

export type NotificationType =
    | 'project_invitation'
    | 'invitation_accepted'
    | 'mention'
    | 'comment_reply'
    | 'reaction'
    | 'correction'
    | 'comment_resolved'
    | 'announcement';

export interface Notification {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    body?: string;
    metadata?: Record<string, any>;
    read: boolean;
    createdAt: string;
}

export const NotificationsService = {
    async getAll(query?: Record<string, any>): Promise<{ data: Notification[]; total: number; limit: number; skip: number }> {
        const { data } = await httpClient.get<any>('/notifications', { params: query });
        return data;
    },

    async markAsRead(id: string): Promise<Notification> {
        const { data } = await httpClient.patch<Notification>(`/notifications/${id}`, { read: true });
        return data;
    },

    async markAllAsRead(): Promise<{ message: string }> {
        const { data } = await httpClient.post<{ message: string }>('/notification-mark-read');
        return data;
    },

    async remove(id: string): Promise<void> {
        await httpClient.delete(`/notifications/${id}`);
    },
};

