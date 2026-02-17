import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UsersService, UpdateProfileData, UserPreferences } from '../services/users.service';

export const useCurrentUser = () => {
    return useQuery({
        queryKey: ['currentUser'],
        queryFn: () => UsersService.getMe(),
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: false,
    });
};

export const useUpdateProfile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: UpdateProfileData) => UsersService.updateMe(data),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['currentUser'] });
        },
    });
};

export const useUpdatePreferences = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (preferences: Partial<UserPreferences>) => UsersService.updatePreferences(preferences),
        onSuccess: (updatedUser) => {
            // Optimistically update the cached user data
            queryClient.setQueryData(['currentUser'], updatedUser);
        },
    });
};
