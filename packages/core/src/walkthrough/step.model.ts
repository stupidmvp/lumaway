
export type StepCondition = {
    type: "event" | "context" | "flag" | "intent";
    key: string;
    value?: string | boolean | number;
};

export interface Step {
    id: string;
    title: string;
    type: 'modal' | 'tooltip' | 'inline' | 'ai-chat';
    content?: string;     // Backward compat
    message?: string;     // Also backward compat
    description?: string; // New primary text field
    purpose?: string;     // AI context description
    target?: string;
    placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
    conditions?: StepCondition[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: any;
}
