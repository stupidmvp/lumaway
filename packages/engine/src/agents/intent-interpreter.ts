import type { EngineEvent, SemanticIntent } from "../types.js";

export interface IntentInterpreter {
    interpret(event: EngineEvent, history: EngineEvent[]): Promise<SemanticIntent>;
}

export class CoreIntentInterpreter implements IntentInterpreter {
    async interpret(event: EngineEvent, history: EngineEvent[]): Promise<SemanticIntent> {
        // MVP: Direct mapping from raw event payloads to semantic categories

        if (event.type === "user.intent") {
            return { category: String(event.intent || "unknown").toLowerCase(), confidence: 1.0 };
        }

        if (event.type === "navigation.change") {
            const route = event.route || "unknown";
            return { category: `route:${route}`, confidence: 0.8 };
        }

        if (event.type === "interaction.detected") {
            const target = event.target || "unknown";
            return { category: `interaction:${target}`, confidence: 0.9 };
        }

        if (event.type === "step.next") {
            return { category: `step_advance:${event.stepId}`, confidence: 1.0 };
        }

        // fallback for internal mechanics or signals
        return { category: "system_update", confidence: 0.5 };
    }
}
