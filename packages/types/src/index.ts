export { };

export interface Step {
    id: string;
    title: string;
    content: string;
    target?: string; // CSS selector or description of element
    placement?: 'auto' | 'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end' | 'right' | 'right-start' | 'right-end';
    trigger?: 'click' | 'hover' | 'manual';
}

export interface Actor {
    id: string;
    name: string;
    slug: string;
    description?: string;
    color?: string;
}

export interface Walkthrough {
    id: string;
    projectId: string;
    title: string;
    steps: Step[];
    actors?: Actor[];
}

export interface ExecutionState {
    walkthroughId: string;
    currentStepIndex: number;
    isCompleted: boolean;
    isDismissed: boolean;
    skippedSteps: string[]; // IDs of skipped steps
}

// VIPER Protocols (Interfaces)

// User Intent / Action
export type UserAction =
    | { type: 'START_WALKTHROUGH'; walkthroughId: string }
    | { type: 'NEXT_STEP' }
    | { type: 'PREV_STEP' }
    | { type: 'DISMISS' }
    | { type: 'COMPLETE' }
    | { type: 'ELEMENT_INTERACTION'; selector: string }; // Passive observation

// View Model (What the SDK receives to render)
export interface GuidancePlan {
    isVisible: boolean;
    content?: {
        stepId: string;
        text: string;
        targetSelector?: string;
        placement: 'auto' | 'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end' | 'right' | 'right-start' | 'right-end';
    };
}
