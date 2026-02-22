import type { ExecutionState, LumaUserContext } from "@luma/core";
import type { EngineEvent, GuidancePlan, ResolverContext } from "./types.js";
import {
    IntentInterpreter,
    ExecutionStateManager,
    WalkthroughResolver,
    StepResolver,
    DeviationDetector,
    FrictionDetector,
    InterventionDecider,
    GuidancePlanner,
    CoreIntentInterpreter,
    CoreExecutionStateManager,
    CoreWalkthroughResolver,
    CoreStepResolver,
    CoreDeviationDetector,
    CoreFrictionDetector,
    CoreInterventionDecider,
    CoreGuidancePlanner
} from "./agents/index.js";

/**
 * Interface that defines the team of agents injected into the Engine pipeline
 */
export interface AgentTeam {
    interpreter: IntentInterpreter;
    stateManager: ExecutionStateManager;
    walkthroughResolver: WalkthroughResolver;
    stepResolver: StepResolver;
    deviationDetector: DeviationDetector;
    frictionDetector: FrictionDetector;
    interventionDecider: InterventionDecider;
    guidancePlanner: GuidancePlanner;
}

/**
 * Creates the default SDD agent team using Core (imperative/deterministic) implementations
 */
export function createDefaultAgentTeam(): AgentTeam {
    return {
        interpreter: new CoreIntentInterpreter(),
        stateManager: new CoreExecutionStateManager(),
        walkthroughResolver: new CoreWalkthroughResolver(),
        stepResolver: new CoreStepResolver(),
        deviationDetector: new CoreDeviationDetector(),
        frictionDetector: new CoreFrictionDetector(),
        interventionDecider: new CoreInterventionDecider(),
        guidancePlanner: new CoreGuidancePlanner()
    };
}

export class EngineResolver {
    private agents: AgentTeam;
    // We would use an external store or DB to persist the history in a production scenario
    private shortTermHistory: EngineEvent[] = [];

    constructor(agents?: AgentTeam) {
        this.agents = agents || createDefaultAgentTeam();
    }

    private getFirstStepId(walkthrough: any): string | null {
        const steps = Array.isArray(walkthrough?.steps) ? walkthrough.steps : [];
        const first = steps.find((s: any) => typeof s?.id === "string" && s.id.trim().length > 0);
        return first?.id ?? null;
    }

    private normalizeText(input: string): string {
        return input
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    private isQuestionIntent(intentText: string): boolean {
        const text = this.normalizeText(intentText);
        return (
            intentText.includes("?")
            || /\b(que|que es|a que se refiere|como funciona|significa|para que sirve|donde veo|explicame)\b/.test(text)
        );
    }

    private wantsGuidedFlow(intentText: string): boolean {
        const text = this.normalizeText(intentText);
        return /\b(guia|guiame|paso a paso|iniciar|empezar|quiero|crear|configurar|hazlo|mostrar pasos|walkthrough)\b/.test(text);
    }

    private extractTerms(intentText: string): string[] {
        const text = this.normalizeText(intentText);
        const tokens = text.split(/[^a-z0-9]+/).filter(Boolean);
        const stopwords = new Set([
            "que", "como", "para", "con", "del", "las", "los", "una", "uno", "por", "donde", "cuando", "porque",
            "quiero", "necesito", "ayuda", "me", "se", "el", "la", "un", "en", "de", "a", "es", "al", "lo", "y"
        ]);
        return tokens.filter((t) => t.length > 2 && !stopwords.has(t));
    }

    private findBestContextSnippet(intentText: string, walkthroughs: any[]): { title: string; description: string } | null {
        const terms = this.extractTerms(intentText);
        if (terms.length === 0) return null;

        let best: { score: number; title: string; description: string } | null = null;
        for (const wt of walkthroughs) {
            const wtTitle = String(wt?.title || "");
            const wtDesc = String(wt?.description || "");
            const stepList = Array.isArray(wt?.steps) ? wt.steps : [];
            const candidates = [
                { title: wtTitle, description: wtDesc },
                ...stepList.map((s: any) => ({
                    title: String(s?.title || ""),
                    description: String(s?.description || s?.purpose || "")
                }))
            ];

            for (const c of candidates) {
                const combined = this.normalizeText(`${c.title} ${c.description}`);
                let score = 0;
                for (const term of terms) {
                    if (combined.includes(term)) score += 1;
                }
                if (score > 0 && (!best || score > best.score)) {
                    best = { score, title: c.title, description: c.description };
                }
            }
        }
        if (!best) return null;
        return { title: best.title, description: best.description };
    }

    private scoreWalkthroughForIntent(intentText: string, walkthrough: any): number {
        const text = intentText.toLowerCase();
        const title = String(walkthrough?.title || "").toLowerCase();
        const description = String(walkthrough?.description || "").toLowerCase();
        const tags = Array.isArray(walkthrough?.tags) ? walkthrough.tags.map((t: any) => String(t).toLowerCase()) : [];

        let score = 0;
        if (title && text.includes(title)) score += 4;
        if (description && (text.includes(description) || description.includes(text))) score += 2;
        for (const tag of tags) {
            if (tag && text.includes(tag)) score += 2;
        }

        const steps = Array.isArray(walkthrough?.steps) ? walkthrough.steps : [];
        for (const step of steps) {
            const stepTitle = String(step?.title || "").toLowerCase();
            const stepDesc = String(step?.description || step?.purpose || "").toLowerCase();
            if (stepTitle && text.includes(stepTitle)) score += 2;
            if (stepDesc && text.includes(stepDesc)) score += 1;
        }

        const triggerValue = String((walkthrough?.trigger as any)?.value || "").toLowerCase();
        if (triggerValue && text.includes(triggerValue)) score += 3;

        return score;
    }

    private buildConversationalPlan(intentText: string, resolverContext: ResolverContext, upgradedState: ExecutionState): GuidancePlan {
        const candidates = [...resolverContext.walkthroughs]
            .filter((w: any) => !upgradedState.completedWalkthroughs?.includes(w.id))
            .map((w: any) => ({ w, score: this.scoreWalkthroughForIntent(intentText, w) }))
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

        const questionMode = this.isQuestionIntent(intentText) && !this.wantsGuidedFlow(intentText);
        const snippet = this.findBestContextSnippet(intentText, resolverContext.walkthroughs as any[]);

        const possibleActions = questionMode
            ? []
            : candidates
                .map(({ w }) => {
                    const stepId = this.getFirstStepId(w);
                    if (!stepId) return null;
                    return {
                        title: String((w as any).title || "Ver guía"),
                        walkthroughId: String((w as any).id || ""),
                        stepId,
                    };
                })
                .filter((v): v is { title: string; walkthroughId: string; stepId: string } => Boolean(v));

        let message = "Entiendo tu duda.";
        if (questionMode) {
            if (snippet?.description) {
                message = `${snippet.title ? `Sobre "${snippet.title}": ` : ""}${snippet.description}`;
            } else {
                message = "No tengo una definición explícita de ese punto en el contexto publicado. Si quieres, te guío al lugar exacto dentro del flujo.";
            }
        } else {
            message = possibleActions.length > 0
                ? "Entiendo tu intención. Te puedo guiar paso a paso desde aquí."
                : "Entiendo tu intención. No encontré un flujo claro para ejecutarlo ahora mismo, pero puedo orientarte.";
        }

        return {
            decision: "INTERVENE",
            action: {
                walkthroughId: "",
                stepId: "",
                targetObjective: "Ver opciones",
                uiStrategy: "chat",
                metadata: {
                    contextOnly: true,
                    questionMode,
                    message,
                    possibleActions,
                }
            }
        };
    }

    /**
     * Orquestador Principal del Ciclo de Decisión del Engine (Pipeline Reactivo) 
     * basado en los principios de diseño SDD
     */
    async resolve(
        event: EngineEvent,
        currentState: ExecutionState,
        userContext: LumaUserContext,
        resolverContext: ResolverContext
    ): Promise<GuidancePlan> {

        const debug = typeof (globalThis as any).__LUMA_ENGINE_DEBUG__ === 'boolean' && (globalThis as any).__LUMA_ENGINE_DEBUG__;
        const log = (label: string, data?: object) => {
            if (debug) console.log(`[LumaEngine:DEBUG] ${label}`, data ?? "");
        };

        // Update local session history (up to last 50 events to avoid memory leak)
        this.shortTermHistory.push(event);
        if (this.shortTermHistory.length > 50) this.shortTermHistory.shift();

        // 1. Ingesta / Normalización de Evento Extendido (Intent)
        const intent = await this.agents.interpreter.interpret(event, this.shortTermHistory);
        log("1. Intent", { category: intent.category, confidence: intent.confidence });

        // 2. Mantenimiento del Mundo / Avanzar Cursor a priori
        const upgradedState = await this.agents.stateManager.advanceState(currentState, event);
        log("2. State after advance", { activeWalkthroughId: upgradedState.activeWalkthroughId, activeStepId: upgradedState.activeStepId, completedSteps: upgradedState.completedSteps?.length });

        // 3. Resolución Táctica y Enrutamiento (Walkthrough / Step)
        const activeWalkthroughId = await this.agents.walkthroughResolver.resolveActiveWalkthrough(intent, upgradedState, resolverContext);
        log("3. Active walkthrough", { activeWalkthroughId });

        // If no walkthrough is active, respond contextually to intent-based questions instead of SILENCE.
        if (!activeWalkthroughId) {
            if (event.type === "user.intent" && typeof event.intent === "string" && event.intent.trim().length > 0) {
                const conversational = this.buildConversationalPlan(event.intent, resolverContext, upgradedState);
                log("3. Conversational fallback", {
                    actions: conversational.action?.metadata?.possibleActions?.length ?? 0
                });
                return conversational;
            }
            log("3. Exit", { reason: "no active walkthrough" });
            return { decision: "SILENCE" };
        }

        const validWalkthrough = resolverContext.walkthroughs.find((w: any) => w.id === activeWalkthroughId);

        let activeStep = null;
        if (validWalkthrough) {
            activeStep = await this.agents.stepResolver.resolveActiveStep(validWalkthrough, upgradedState);
            log("3. Active step", { stepId: activeStep?.id, target: (activeStep as any)?.target });

            // 3.5 Auto-Completado Orgánico (Heurística SDD: Si la UI emite evidencia de cumplir el objetivo, avanzar automáticamente)
            if (activeStep) {
                const stepTarget = (activeStep as any).target || activeStep.metadata?.targetSelector;
                const hasTarget = typeof stepTarget === "string" && stepTarget.trim().length > 0;
                const targetMatch = event.type === "interaction.detected"
                    && typeof stepTarget === "string"
                    && event.target === stepTarget;

                // TODO: Metadata route needs to be matched differently if there's variables
                const stepRoute = typeof activeStep.metadata?.route === 'string' ? activeStep.metadata.route : undefined;
                // Route match should auto-complete only transition steps (no concrete target on page).
                // Otherwise it can skip actionable steps just because the user is on the same route.
                const routeMatch = !hasTarget
                    && event.type === "navigation.change"
                    && event.route === stepRoute;

                if (targetMatch || routeMatch) {
                    log("3.5 Auto-complete", { stepId: activeStep.id, stepTarget, hasTarget, targetMatch, routeMatch });
                    if (!upgradedState.completedSteps.includes(activeStep.id)) {
                        upgradedState.completedSteps.push(activeStep.id);
                    }
                    // Re-resolve next step now that current is completed
                    activeStep = await this.agents.stepResolver.resolveActiveStep(validWalkthrough, upgradedState);
                    log("3.5 Next step after auto-complete", { stepId: activeStep?.id });
                }
            }
        }

        // 4. Análisis Táctico paralelo (Desviación y Fricción)
        const [deviationContext, frictionContext] = await Promise.all([
            this.agents.deviationDetector.detectDeviation(this.shortTermHistory, activeStep),
            this.agents.frictionDetector.detectFriction(this.shortTermHistory, upgradedState)
        ]);

        // 5. El Veredicto Final: ¿Intervenimos o nos callamos?
        const decision = await this.agents.interventionDecider.decide(deviationContext, frictionContext, upgradedState);
        log("5. Decision", { decision, hasActiveStep: !!activeStep });

        // 6. Emisión del Plan
        if (decision === "INTERVENE" && activeStep && activeWalkthroughId) {
            const plan = await this.agents.guidancePlanner.planGuidance(activeWalkthroughId, activeStep, deviationContext, frictionContext, validWalkthrough as any);
            log("6. Plan", { stepId: activeStep.id, targetSelector: plan.action?.metadata?.targetSelector });
            return plan;
        }

        return { decision: "SILENCE" };
    }
}
