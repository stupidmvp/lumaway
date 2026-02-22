import type { GuidancePlan as UIPlan } from "@luma/core";
import type { GuidancePlan as EnginePlan } from "@luma/engine";

export class LumaPresenter {
    present(enginePlan: EnginePlan): UIPlan | null {
        if (enginePlan.decision !== "INTERVENE" || !enginePlan.action) {
            return null;
        }

        const action = enginePlan.action;

        return {
            message: action.metadata?.message || "",
            suggestedAction: action.targetObjective,
            possibleActions: Array.isArray(action.metadata?.possibleActions) ? action.metadata.possibleActions : [],
            canIgnore: true,
            metadata: {
                ...action.metadata,
                walkthroughId: action.walkthroughId,
                stepId: action.stepId,
                stepName: action.metadata?.title,
                targetSelector: action.metadata?.targetSelector,
                placement: action.metadata?.placement
            }
        };
    }
}
