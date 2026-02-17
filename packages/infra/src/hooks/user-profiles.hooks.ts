import { useQuery } from '@tanstack/react-query';
import { UserProfilesService } from '../services/user-profiles.service';

export const useUserProfile = (userId: string | undefined) => {
    return useQuery({
        queryKey: ['user-profiles', userId],
        queryFn: () => UserProfilesService.get(userId!),
        enabled: !!userId,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

