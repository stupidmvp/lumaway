import type { GuidancePlan, DeviationContext, FrictionContext } from "../types.js";
import type { Step, Walkthrough } from "@luma/core";

export interface GuidancePlanner {
    planGuidance(activeWalkthroughId: string, activeStep: Step, deviation: DeviationContext, friction: FrictionContext, walkthrough?: Walkthrough): Promise<GuidancePlan>;
}

export class CoreGuidancePlanner implements GuidancePlanner {
    async planGuidance(activeWalkthroughId: string, activeStep: Step, deviation: DeviationContext, friction: FrictionContext, walkthrough?: Walkthrough): Promise<GuidancePlan> {

        // Mapeamos el tipo visual del Step al tipo de estrategia UI esperado en el GuidancePlan
        let strategy: "tooltip" | "chat" | "modal" | "invisible" = "invisible";
        if (activeStep.type === "tooltip") strategy = "tooltip";
        if (activeStep.type === "modal") strategy = "modal";
        if (activeStep.type === "ai-chat") strategy = "chat";

        // Calculate step position for the tooltip counter
        const steps = (walkthrough as any)?.steps || [];
        const stepIndex = steps.findIndex((s: any) => s.id === activeStep.id);
        const totalSteps = steps.length;
        const walkthroughName = (walkthrough as any)?.title || activeWalkthroughId;
        const route = (activeStep as any).metadata?.route || (activeStep as any).route;

        return {
            decision: "INTERVENE",
            action: {
                walkthroughId: activeWalkthroughId,
                stepId: activeStep.id,
                targetObjective: activeStep.title || activeStep.purpose || "Completar paso",
                uiStrategy: strategy,
                metadata: {
                    title: activeStep.title,
                    message: activeStep.description || (activeStep as any).message || (activeStep as any).content,
                    targetSelector: activeStep.target || (activeStep.metadata as any)?.targetSelector,
                    placement: activeStep.placement || (activeStep.metadata as any)?.placement,
                    // Navigation metadata for tooltip counter & progress
                    stepIndex: stepIndex >= 0 ? stepIndex : 0,
                    totalSteps,
                    walkthroughName,
                    route,
                }
            }
        };
    }
}
