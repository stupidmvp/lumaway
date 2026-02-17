import { useMutation, useQueryClient } from '@tanstack/react-query';
import { OnboardingService, OnboardingData } from '../services/onboarding.service';

export const useCompleteOnboarding = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: OnboardingData) => OnboardingService.completeOnboarding(data),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['currentUser'] });
        },
    });
};

export const useSkipOnboarding = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => OnboardingService.skipOnboarding(),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['currentUser'] });
        },
    });
};


