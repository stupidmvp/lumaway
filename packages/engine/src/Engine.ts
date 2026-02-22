import type { ExecutionState, LumaUserContext, Walkthrough } from "@luma/core";
import { EngineResolver, createDefaultAgentTeam } from "./resolver.js";
import type { EngineEvent, GuidancePlan, ResolverContext } from "./types.js";
import type { AgentTeam } from "./resolver.js";

export class LumaEngine {
    private resolver: EngineResolver;

    constructor(customAgents?: Partial<AgentTeam>) {
        // Permitir inyectar agentes custom (ej. integraciones con LLM reales) 
        // o usar los CoreAgents deterministas por defecto.
        const team = { ...createDefaultAgentTeam(), ...customAgents };
        this.resolver = new EngineResolver(team);
    }

    async processEvent(
        event: EngineEvent,
        state: ExecutionState,
        context: LumaUserContext,
        walkthroughs: Walkthrough[]
    ): Promise<GuidancePlan> {
        const resolverContext: ResolverContext = { walkthroughs };
        return await this.resolver.resolve(event, state, context, resolverContext);
    }
}
