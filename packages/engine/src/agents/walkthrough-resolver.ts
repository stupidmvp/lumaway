import type { Walkthrough, ExecutionState } from "@luma/core";
import type { SemanticIntent, ResolverContext } from "../types.js";

export interface WalkthroughResolver {
    resolveActiveWalkthrough(intent: SemanticIntent, state: ExecutionState, context: ResolverContext): Promise<string | null>;
}

export class CoreWalkthroughResolver implements WalkthroughResolver {
    async resolveActiveWalkthrough(intent: SemanticIntent, state: ExecutionState, context: ResolverContext): Promise<string | null> {

        // 1. If there's an active walkthrough in state, respect it (unless intent explicitly cancels it)
        if (state.activeWalkthroughId) {
            // MVP: We assume we just continue it. 
            // Advance cancellation or switch logic would go here.
            return state.activeWalkthroughId;
        }

        // 2. Otherwise search for a Walkthrough that matches the new intent
        const intentCategory = intent.category.toLowerCase();

        for (const walkthrough of context.walkthroughs) {
            // Skip completed ones unless repeatable
            if (state.completedWalkthroughs.includes(walkthrough.id) && !walkthrough.repeatable) {
                continue;
            }

            if (walkthrough.trigger) {
                const { type, value } = walkthrough.trigger;
                const valueLower = value.toLowerCase();

                if (type === 'intent' && intentCategory.includes(valueLower)) {
                    return walkthrough.id;
                }

                if (type === 'route' && intentCategory.startsWith('route:')) {
                    const routeStr = intentCategory.replace('route:', '');
                    try {
                        const regex = new RegExp(value);
                        if (regex.test(routeStr)) return walkthrough.id;
                    } catch (e) {
                        if (routeStr === valueLower) return walkthrough.id;
                    }
                }

                if (type === 'interaction' && intentCategory === `interaction:${valueLower}`) {
                    return walkthrough.id;
                }
            }

            // Fallback Semantic Intent matching:
            if (walkthrough.intent && intentCategory.includes(walkthrough.intent.toLowerCase())) {
                return walkthrough.id;
            }
        }

        return null;
    }
}
