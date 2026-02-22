import type { InterventionDecision, DeviationContext, FrictionContext } from "../types.js";
import type { ExecutionState } from "@luma/core";

export interface InterventionDecider {
    decide(deviation: DeviationContext, friction: FrictionContext, state: ExecutionState): Promise<InterventionDecision>;
}

export class CoreInterventionDecider implements InterventionDecider {
    async decide(deviation: DeviationContext, friction: FrictionContext, state: ExecutionState): Promise<InterventionDecision> {

        // MVP: Siempre intervenimos si el motor resolvió que hay un paso activo a sugerir
        // porque el cliente (Host UI) espera saber qué mostrar.
        // El "SILENCE" ya se retorna anticipadamente en resolver.ts si no hay Walkthrough activo.

        // En el futuro, si hay fricción ALTA, podríamos cambiar el tipo de intervención 
        // (ej. forzar popup en vez de tooltip sutil), pero la decisión base de "hablar" o no es afirmativa
        // mientras haya un objetivo válido que cumplir.
        return "INTERVENE";
    }
}
