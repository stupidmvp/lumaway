import { Walkthrough, ExecutionState, GuidancePlan, Step } from '@luma/types';

export class GuidancePresenter {
    public present(walkthrough: Walkthrough, state: ExecutionState): GuidancePlan {
        if (state.isCompleted || state.isDismissed) {
            return { isVisible: false };
        }

        const step = walkthrough.steps[state.currentStepIndex];
        if (!step) {
            return { isVisible: false };
        }

        // Logic to format the step for the view
        // Antigravity: We just enable visibility. The View handles the "politeness".

        return {
            isVisible: true,
            content: {
                stepId: step.id,
                text: step.content,
                targetSelector: step.target,
                placement: step.placement || 'auto'
            }
        };
    }
}
