import { httpClient } from '../http/client';

export interface OnboardingData {
    organizationName: string;
    organizationSlug: string;
    projectName?: string;
}

export interface OnboardingResponse {
    organization: {
        id: string;
        name: string;
        slug: string;
    };
    project: {
        id: string;
        name: string;
    } | null;
    onboardingCompleted: boolean;
}

export interface SkipOnboardingResponse {
    onboardingCompleted: boolean;
}

export const OnboardingService = {
    async completeOnboarding(data: OnboardingData): Promise<OnboardingResponse> {
        const { data: result } = await httpClient.post<OnboardingResponse>('/auth-onboarding', data);
        return result;
    },

    async skipOnboarding(): Promise<SkipOnboardingResponse> {
        const { data: result } = await httpClient.post<SkipOnboardingResponse>('/auth-onboarding-skip');
        return result;
    },
};


