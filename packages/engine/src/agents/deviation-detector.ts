import type { EngineEvent, DeviationContext } from "../types.js";
import type { Step } from "@luma/core";

export interface DeviationDetector {
    detectDeviation(events: EngineEvent[], activeStep: Step | null): Promise<DeviationContext>;
}

export class CoreDeviationDetector implements DeviationDetector {
    async detectDeviation(events: EngineEvent[], activeStep: Step | null): Promise<DeviationContext> {
        if (!activeStep || events.length === 0) {
            return { level: "NONE", type: "no_context" };
        }

        const latestEvent = events[events.length - 1];
        if (!latestEvent) return { level: "NONE", type: "no_context" };

        // MVP: Si el usuario navegó a una ruta distinta a la esperada en este paso
        if (latestEvent.type === "navigation.change" && "route" in latestEvent) {
            const expectedRoute = typeof activeStep?.metadata?.route === 'string' ? activeStep.metadata.route : undefined;
            if (expectedRoute && expectedRoute !== latestEvent.route) {
                return { level: "CRITICAL", type: "route_mismatch" };
            }
        }

        return { level: "NONE", type: "happy_path" };
    }
}
