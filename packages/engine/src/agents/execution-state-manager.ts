import type { ExecutionState } from "@luma/core";
import type { EngineEvent } from "../types.js";

export interface ExecutionStateManager {
    advanceState(currentState: ExecutionState, event: EngineEvent): Promise<ExecutionState>;
}

export class CoreExecutionStateManager implements ExecutionStateManager {
    async advanceState(currentState: ExecutionState, event: EngineEvent): Promise<ExecutionState> {
        // Clone and mutate locally to keep state immutable-like for react/clients
        const nextState = { ...currentState };
        nextState.updatedAt = Date.now();
        nextState.history = nextState.history || [];

        // Store event in execution history
        nextState.history.push({
            type: event.type,
            payload: { ...event, id: undefined, timestamp: undefined },
            timestamp: Date.now()
        });

        // Keep history bounded
        if (nextState.history.length > 50) nextState.history.shift();

        // 1. Explicit Engine Controls (The UI tells the Engine what the user just did regarding the Walkthrough UI)
        if (event.type === "system.signal") {
            const action = event.name;

            switch (action) {
                case "walkthrough_completed": {
                    const wId = event.payload?.walkthroughId;
                    if (wId && !nextState.completedWalkthroughs.includes(wId)) {
                        nextState.completedWalkthroughs.push(wId);
                    }

                    // If it was the active one, clear context
                    if (nextState.activeWalkthroughId === wId) {
                        nextState.activeWalkthroughId = undefined;
                        nextState.activeStepId = undefined;
                    }
                    break;
                }

                case "start_walkthrough": {
                    // Explicit instruction from UI (e.g Chat suggestion click) to start a Walkthrough
                    const wId = event.payload?.walkthroughId;
                    const sId = event.payload?.stepId;

                    if (wId) {
                        nextState.activeWalkthroughId = wId;
                        // Start fresh, or go to specific step
                        nextState.activeStepId = sId || undefined;

                        // Force re-execution by removing them from completed arrays
                        nextState.completedWalkthroughs = nextState.completedWalkthroughs.filter(id => id !== wId);
                        if (sId) {
                            nextState.completedSteps = nextState.completedSteps.filter(id => id !== sId);
                        }
                    }
                    break;
                }

                case "step_completed": {
                    const sId = event.payload?.stepId;
                    if (sId && !nextState.completedSteps.includes(sId)) {
                        nextState.completedSteps.push(sId);
                    }
                    break;
                }

                case "cancel_walkthrough": {
                    nextState.activeWalkthroughId = undefined;
                    nextState.activeStepId = undefined;
                    break;
                }
            }
        }

        // 2. Direct Step Advance
        if (event.type === "step.next") {
            nextState.activeWalkthroughId = event.walkthroughId;
            nextState.activeStepId = event.stepId;
        }

        return nextState;
    }
}
