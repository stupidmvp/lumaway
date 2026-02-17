import { Walkthrough, ExecutionState, UserAction, Step } from '@luma/types';

export class WalkthroughInteractor {
    private state: ExecutionState;
    private walkthrough: Walkthrough;
    private listeners: ((state: ExecutionState) => void)[] = [];

    constructor(walkthrough: Walkthrough) {
        this.walkthrough = walkthrough;
        this.state = {
            walkthroughId: walkthrough.id,
            currentStepIndex: 0,
            isCompleted: false,
            isDismissed: false,
            skippedSteps: []
        };
    }

    public getWalkthrough(): Walkthrough {
        return this.walkthrough;
    }

    public subscribe(listener: (state: ExecutionState) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notify(): void {
        this.listeners.forEach(l => l(this.state));
    }

    public handleAction(action: UserAction): void {
        if (this.state.isCompleted || this.state.isDismissed) return;

        switch (action.type) {
            case 'NEXT_STEP':
                this.advance();
                break;
            case 'PREV_STEP':
                this.regress();
                break;
            case 'DISMISS':
                this.state.isDismissed = true;
                this.notify();
                break;
            case 'COMPLETE':
                this.state.isCompleted = true;
                this.notify();
                break;
            case 'ELEMENT_INTERACTION':
                // Antigravity: If user interacts with the target of the current step, auto-advance?
                // Or specific logic. For now, we'll keep it simple.
                this.checkAutoAdvance(action.selector);
                break;
        }
    }

    private advance(): void {
        if (this.state.currentStepIndex < this.walkthrough.steps.length - 1) {
            this.state.currentStepIndex++;
            this.notify();
        } else {
            this.state.isCompleted = true;
            this.notify();
        }
    }

    private regress(): void {
        if (this.state.currentStepIndex > 0) {
            this.state.currentStepIndex--;
            this.notify();
        }
    }

    private checkAutoAdvance(selector: string): void {
        const currentStep = this.walkthrough.steps[this.state.currentStepIndex];
        if (currentStep?.target && currentStep.target === selector) {
            // If user interacted with the target, maybe we advance?
            // Basic heuristic: if trigger is 'click' and they clicked it (assumption: action is click-like if generic interaction)
            // We'll refine this later.
            this.advance();
        }
    }

    public getState(): ExecutionState {
        return { ...this.state };
    }
}
