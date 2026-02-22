import type { EngineEvent, FrictionContext } from "../types.js";
import type { ExecutionState } from "@luma/core";

export interface FrictionDetector {
    detectFriction(history: EngineEvent[], state: ExecutionState): Promise<FrictionContext>;
}

export class CoreFrictionDetector implements FrictionDetector {
    async detectFriction(history: EngineEvent[], state: ExecutionState): Promise<FrictionContext> {
        if (!state.activeStepId) {
            return { level: "LOW", diagnosis: "No active step" };
        }

        let actionsSinceLastStep = 0;

        // Count user actions from end of history backwards until we hit a step completion or forcing event
        for (let i = history.length - 1; i >= 0; i--) {
            const ev = history[i];
            if (!ev) continue;
            if ((ev.type === "system.signal" && "name" in ev && ev.name === "step_completed") || ev.type === "step.next") {
                break;
            }

            if (ev.type === "interaction.detected" || ev.type === "navigation.change") {
                actionsSinceLastStep++;
            }
        }

        if (actionsSinceLastStep > 10) {
            return { level: "HIGH", diagnosis: "Alta cantidad de acciones registradas sin avance en el flujo." };
        }

        if (actionsSinceLastStep > 5) {
            return { level: "MEDIUM", diagnosis: "Posible confusión detectada (varias interacciones inútiles)." };
        }

        return { level: "LOW", diagnosis: "Flujo liso y normal." };
    }
}
