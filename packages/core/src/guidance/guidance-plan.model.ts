export interface GuidancePlan {
    message: string;
    suggestedAction?: string; // Legacy: Main action
    possibleActions?: Array<{ // New: Multiple actions
        title: string;
        walkthroughId: string;
        stepId: string;
    }>;
    canIgnore: boolean;
    metadata?: Record<string, any>;
    config?: {
        name: string;
        logo: string | null;
        settings: {
            assistantName?: string;
            assistantWelcomeMessage?: string;
            [key: string]: any;
        };
    };
}
