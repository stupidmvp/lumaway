// Public type surface for @lumaway/sdk.
//
// These are the types that appear in the SDK's public API (method signatures,
// callback payloads, config objects, etc.). They mirror the source types in
// @luma/core so that once the SDK is built, the published .d.ts can be fully
// self-contained without referencing the internal @luma/* workspace packages.
//
// Keep this file in sync with packages/core/src/**.

// ────────────────────────────── user context ──────────────────────────────

export interface LumaUserContext {
    userId?: string;
    roles?: string[];
    locale?: string;
    flags?: Record<string, boolean>;
    user?: {
        firstName?: string;
        lastName?: string;
        email?: string;
    };
}

// ───────────────────────────────── events ─────────────────────────────────

export interface InteractionEvent {
    type: "interaction.detected";
    interactionType: "click" | "focus" | "gesture";
    target: string;
    metadata?: Record<string, any>;
}

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

export type LumaEvent =
    | NavigationEvent
    | UserIntentEvent
    | InteractionEvent
    | StepNextEvent
    | SystemEvent;

// ──────────────────────────────── guidance ────────────────────────────────

export interface GuidancePlan {
    message: string;
    /** Legacy: main action. */
    suggestedAction?: string;
    /** New: multiple possible actions. */
    possibleActions?: Array<{
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

// ──────────────────────────────── walkthrough ─────────────────────────────

export type StepCondition = {
    type: "event" | "context" | "flag" | "intent";
    key: string;
    value?: string | boolean | number;
};

export interface Step {
    id: string;
    title: string;
    type: "modal" | "tooltip" | "inline" | "ai-chat";
    /** Backward-compat. */
    content?: string;
    /** Backward-compat. */
    message?: string;
    /** Primary text field. */
    description?: string;
    /** AI context description. */
    purpose?: string;
    target?: string;
    placement?: "top" | "bottom" | "left" | "right" | "center";
    conditions?: StepCondition[];
    metadata?: any;
}

export interface WalkthroughReference {
    walkthroughId: string;
    required?: boolean;
    order?: number;
    dependsOn?: string[];
}

export type WalkthroughGoal = "conversion" | "adoption" | "support" | "onboarding";

export interface Walkthrough {
    id: string;
    projectId: string;
    name?: string;
    title?: string;
    intent?: string;
    description?: string;
    metadata?: Record<string, any>;
    goals?: WalkthroughGoal[];

    steps?: Step[];
    dependencies?: WalkthroughReference[];

    parentId?: string | null;
    previousWalkthroughId?: string | null;
    nextWalkthroughId?: string | null;

    repeatable?: boolean;
    priority?: "high" | "medium" | "low";
    executionMode?: "automatic" | "manual" | "ai-suggested";

    trigger?: {
        type: "route" | "event" | "interaction" | "intent";
        value: string;
    };

    views?: number;
    completions?: number;
    conversionRate?: number;
}

// ──────────────────────────────── execution ───────────────────────────────

export interface ExecutionEventRecord {
    type: string;
    payload?: any;
    timestamp: number;
}

export interface ExecutionState {
    projectId: string;
    userId: string;
    activeWalkthroughId?: string;
    activeStepId?: string;
    completedWalkthroughs: string[];
    completedSteps: string[];
    history: ExecutionEventRecord[];
    startedAt: number;
    updatedAt: number;
}
