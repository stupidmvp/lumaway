export interface InteractionEvent {
    type: "interaction.detected";
    interactionType: "click" | "focus" | "gesture";
    target: string;
    metadata?: Record<string, any>;
}

export type LumaEvent =
    | NavigationEvent
    | UserIntentEvent
    | InteractionEvent
    | StepNextEvent
    | SystemEvent;

export interface StepNextEvent {
    type: "step.next";
    walkthroughId: string;
    stepId: string;
}

export interface NavigationEvent {
    type: "navigation.change";
    route: string;
}

export interface UserIntentEvent {
    type: "user.intent";
    intent: string;
}

export interface SystemEvent {
    type: "system.signal";
    name: string;
    payload?: any;
}
