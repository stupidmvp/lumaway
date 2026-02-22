import type { Step } from "./step.model.js";
import type { WalkthroughReference } from "./dependency.model.js";

type WalkthroughGoal = "conversion" | "adoption" | "support" | "onboarding";

export interface Walkthrough {
    id: string;
    projectId: string;
    name?: string;       // Optional - some walkthroughs use 'title' instead
    title?: string;      // Optional - some walkthroughs use 'name' instead
    intent?: string;     // Natural language description of what this achieves
    description?: string; // Detailed description for AI context
    metadata?: Record<string, any>;
    goals?: WalkthroughGoal[];
    
    // Core structure
    steps?: Step[];
    dependencies?: WalkthroughReference[];
    
    // Orchestration and sequencing
    parentId?: string | null;              // Parent orchestrator walkthrough
    previousWalkthroughId?: string | null; // Previous walkthrough in sequence
    nextWalkthroughId?: string | null;     // Next walkthrough in sequence
    
    // Delivery config
    repeatable?: boolean;
    priority?: "high" | "medium" | "low";
    executionMode?: 'automatic' | 'manual' | 'ai-suggested';
    
    // Activation triggers
    trigger?: {
        type: 'route' | 'event' | 'interaction' | 'intent';
        value: string; // regex, event name, selector, or semantic topic
    };
    
    // Tracking/Analytics (Optional for frontend use)
    views?: number;
    completions?: number;
    conversionRate?: number;
}
