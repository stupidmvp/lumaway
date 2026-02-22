import type { Walkthrough, LumaEvent } from "@luma/core";

// --- 1. Inputs del Sistema (Eventos) ---
// Extendemos LumaEvent del core agregando campos operativos para el pipeline del Engine
export type EngineEvent = LumaEvent & {
    id: string;
    timestamp: string;
};

// --- 2. Elementos de Estado Mantenido ---
export type EngineStatus = "IDLE" | "IN_PROGRESS" | "SUSPENDED" | "COMPLETED" | "ABORTED";

// --- 3. Outputs de Intermedio (Agentes) ---
export interface SemanticIntent {
    category: string; // ej. 'Search_Config', 'Start_Checkout'
    confidence: number;
}

export interface DeviationContext {
    level: "NONE" | "BENIGN" | "CRITICAL";
    type: string; // ej. 'route_mismatch', 'unrelated_action'
}

export interface FrictionContext {
    level: "LOW" | "MEDIUM" | "HIGH";
    diagnosis: string;
}

export interface ResolverContext {
    walkthroughs: Walkthrough[];
}

// --- 4. Objeto de Respuesta Final (GuidancePlan) ---
export type InterventionDecision = "INTERVENE" | "SILENCE";

export interface SuggestedAction {
    walkthroughId: string;
    stepId: string;
    targetObjective: string; // Meta que el usuario debe concretar ("Haz click en 'Comprar'")
    uiStrategy: "tooltip" | "chat" | "modal" | "invisible";
    metadata?: Record<string, any>;
}

export interface GuidancePlan {
    decision: InterventionDecision;
    action?: SuggestedAction;
    // action es undefined si decision es SILENCE
}
