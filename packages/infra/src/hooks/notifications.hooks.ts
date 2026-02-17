import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NotificationsService } from '../services/notifications.service';

export const useNotifications = (limit: number = 20) => {
    return useQuery({
        queryKey: ['notifications', limit],
        queryFn: () => NotificationsService.getAll({
            $sort: { createdAt: -1 },
            $limit: limit,
        }),
        refetchInterval: 30000, // Poll every 30s
    });
};

export const useUnreadNotificationsCount = () => {
    return useQuery({
        queryKey: ['notifications', 'unread-count'],
        queryFn: async () => {
            const result = await NotificationsService.getAll({
                read: false,
                $limit: 1, // Minimal fetch — we only need the total count
            });
            return result?.total ?? 0;
        },
        refetchInterval: 15000, // Poll every 15s
    });
};

export const useMarkNotificationAsRead = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => NotificationsService.markAsRead(id),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['notifications'] }),
            ]);
        },
    });
};

export const useMarkAllNotificationsAsRead = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => NotificationsService.markAllAsRead(),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
};

