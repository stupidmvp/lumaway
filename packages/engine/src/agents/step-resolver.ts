import type { Walkthrough, ExecutionState, Step } from "@luma/core";

export interface StepResolver {
    resolveActiveStep(walkthrough: Walkthrough, state: ExecutionState): Promise<Step | null>;
}

export class CoreStepResolver implements StepResolver {
    async resolveActiveStep(walkthrough: Walkthrough, state: ExecutionState): Promise<Step | null> {
        if (!walkthrough.steps || walkthrough.steps.length === 0) return null;

        // If no active step yet, or we're just starting, it's the first step
        if (!state.activeStepId) {
            return walkthrough.steps[0] as Step;
        }

        const currentIndex = walkthrough.steps.findIndex((s: any) => s.id === state.activeStepId);

        // If we can't find it in the current walkthrough, default to first step
        if (currentIndex === -1) {
            return walkthrough.steps[0] as Step;
        }

        // Check if current step is completed
        if (state.completedSteps.includes(state.activeStepId)) {
            // We must advance to next step
            if (currentIndex < walkthrough.steps.length - 1) {
                return walkthrough.steps[currentIndex + 1] as Step;
            } else {
                // Reached the end
                return null;
            }
        }

        // Still on the current step
        return walkthrough.steps[currentIndex] as Step;
    }
}
