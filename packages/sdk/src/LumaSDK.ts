import { LumaEngine } from "@luma/engine";
import { LumaPresenter } from "@luma/presenters";
import type {
    ExecutionState,
    GuidancePlan,
    LumaEvent,
    LumaUserContext,
    Walkthrough
} from "@luma/core";
import { LumaClient } from "./LumaClient.js";
import type { LumaClientConfig } from "./LumaClient.js";
import { Tooltip } from "./ui/Tooltip.js";
import { Assistant, type ChatMessage } from "./ui/Assistant.js";
import { InteractionObserver } from "./InteractionObserver.js";

/** Persisted chat history by session key (apiKey:userId) so it survives SDK/Assistant re-creation. */
const messageHistoryStore: Record<string, ChatMessage[]> = {};

function getHistoryKey(apiKey: string, userId?: string): string {
    return `${apiKey}:${userId || "anonymous"}`;
}

export class LumaSDK {
    private static readonly UI_NOTIFY_DEBOUNCE_MS = 120;
    private static readonly STREAM_PAINT_THROTTLE_MS = 50;
    private static readonly INTENT_SUGGEST_DEBOUNCE_MS = 180;
    private config: LumaClientConfig;
    private engine: LumaEngine;
    private presenter: LumaPresenter;
    private client: LumaClient;
    private state: ExecutionState;
    private context: LumaUserContext;
    private walkthroughs: Walkthrough[] = [];
    private projectConfig: any = null;
    private tooltip: Tooltip;
    private assistant: Assistant;
    // @ts-ignore
    private observer: InteractionObserver;

    private subscribers: ((plan: GuidancePlan | null) => void)[] = [];
    private lastPlan: string | null = null;
    private webMCPAvailable: boolean = false;
    private webMCPConfig: any = null;
    private debugMode: boolean = false;
    private eventQueue: Promise<void> = Promise.resolve();
    private notifyTimer: number | null = null;
    private pendingPlan: GuidancePlan | null = null;
    private pendingForceRender = false;
    private intentSuggestTimer: number | null = null;
    private recentRouteSignal: string = "/";
    private recentInteractionSignals: string[] = [];
    private recentChatSignals: string[] = [];

    constructor(config: LumaClientConfig, userContext: LumaUserContext = {}) {
        this.debugMode = config.debug === true;
        console.log("LumaWay SDK: Initializing...", { config: { ...config, apiKey: config.apiKey ? "[REDACTED]" : undefined }, userContext, debug: this.debugMode });
        this.config = config;
        this.client = new LumaClient(config);
        this.engine = new LumaEngine();
        this.presenter = new LumaPresenter();
        this.context = userContext;

        const historyKey = getHistoryKey(config.apiKey, userContext.userId ?? "");
        const messageHistory = messageHistoryStore[historyKey] ?? (messageHistoryStore[historyKey] = []);

        // Assistant with persisted history so conversation survives re-mounts
        this.assistant = new Assistant(
            (intent: string) => this.trackIntent(intent),
            (walkthroughId: string, stepId?: string) => this.startWalkthrough(walkthroughId, stepId),
            {
                initialMessages: messageHistory,
                onMessageAdded: (msg) => {
                    messageHistory.push(msg);
                },
            }
        );

        // Zero-config Tooltip
        this.tooltip = new Tooltip(
            () => {
                console.log("LumaWay SDK: Tooltip dismissed.");
                this.scheduleNotify(null);
            },
            (walkthroughId: string, stepId: string) => {
                this.completeStep(walkthroughId, stepId);
            },
            (walkthroughId: string, stepId: string) => {
                this.goToPreviousStep(walkthroughId, stepId);
            },
            (selector: string) => {
                this.trackInteraction(selector);
            },
            () => this.assistant ? this.assistant.isOpen : false
        );

        // Initialize empty state
        this.state = {
            projectId: "unknown",
            userId: userContext.userId || "anonymous",
            completedWalkthroughs: [],
            completedSteps: [],
            history: [],
            startedAt: Date.now(),
            updatedAt: Date.now(),
        };

        this.observer = new InteractionObserver((event) => this.emitEvent(event));

        this.init().catch(err => {
            console.error("LumaWay SDK: Initialization failed:", err);
        });
    }

    private async init() {
        console.log("LumaWay SDK: Fetching configuration...");
        this.projectConfig = await this.client.fetchProjectConfig();

        // Check WebMCP availability and configuration
        this.webMCPAvailable = this.checkWebMCPAvailable();
        this.webMCPConfig = this.projectConfig?.settings?.webMCP || null;

        if (this.webMCPAvailable && this.webMCPConfig?.enabled) {
            console.log("LumaWay SDK: WebMCP available and enabled", {
                permissionLevel: this.webMCPConfig.permissionLevel,
                allowedActions: this.webMCPConfig.allowedActions
            });
        } else {
            console.log("LumaWay SDK: WebMCP not available or disabled");
        }

        console.log("LumaWay SDK: Fetching walkthroughs...");
        this.walkthroughs = await this.client.fetchWalkthroughs();
        this.reportInvalidTargets(this.walkthroughs);
        // The engine now accepts walkthroughs directly in processEvent
        this.setupNavigationTracking();

        // Initial notification with config
        this.scheduleNotify(null, true);
        this.pushIntentSignal("route", window.location.pathname);

        console.log("LumaWay SDK: Ready 🚀");
    }

    private reportInvalidTargets(walkthroughs: Walkthrough[]) {
        for (const wt of walkthroughs as any[]) {
            const steps = Array.isArray(wt?.steps) ? wt.steps : [];
            for (const step of steps) {
                const target = step?.target;
                if (typeof target !== "string" || !target.trim()) continue;
                // Unsupported by document.querySelector; should be fixed at source (DB/seed/CMS)
                if (target.includes(":has-text(")) {
                    console.warn("LumaWay SDK: Invalid target selector in walkthrough data (unsupported pseudo selector)", {
                        walkthroughId: wt?.id,
                        stepId: step?.id,
                        target,
                    });
                    continue;
                }
                try {
                    if (document.querySelector(target) === null) {
                        console.warn("LumaWay SDK: Target selector not found in current DOM. Ensure walkthrough data is aligned with host IDs.", {
                            walkthroughId: wt?.id,
                            stepId: step?.id,
                            target,
                            route: window.location.pathname,
                        });
                    }
                } catch {
                    console.warn("LumaWay SDK: Invalid CSS selector in walkthrough data.", {
                        walkthroughId: wt?.id,
                        stepId: step?.id,
                        target,
                    });
                }
            }
        }
    }

    /**
     * Check if WebMCP is available in the browser
     */
    private checkWebMCPAvailable(): boolean {
        if (typeof window === 'undefined') {
            return false;
        }

        // In host environments we can still use WebMCP-style contextual reasoning
        // based on route + interaction + chat signals even if browser MCP APIs are limited.
        return true;

        // Future implementation:
        // return 'mcp' in window && typeof (window as any).mcp === 'object';
    }

    public subscribe(callback: (plan: GuidancePlan | null) => void) {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter((s) => s !== callback);
        };
    }

    /** Enable/disable step-by-step debug logs (event, engine plan, UI plan, notify). */
    public setDebug(enabled: boolean) {
        this.debugMode = enabled;
    }

    private logStep(step: string, data?: unknown) {
        if (this.debugMode) {
            console.log(`[LumaWay SDK:DEBUG] ${step}`, data !== undefined ? data : "");
        }
    }

    public emitEvent(event: LumaEvent): Promise<void> {
        this.eventQueue = this.eventQueue
            .then(() => this.processEvent(event))
            .catch((err) => {
                console.error("LumaWay SDK: Event processing failed", err);
            });
        return this.eventQueue;
    }

    private async processEvent(event: LumaEvent): Promise<void> {
        this.logStep("1. Event received", { type: event.type, name: (event as any).name, payload: (event as any).payload });
        const engineEvent = {
            ...event,
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString()
        } as any;

        const enginePlan = await this.engine.processEvent(engineEvent, this.state, this.context, this.walkthroughs);
        this.logStep("2. Engine plan", { decision: enginePlan.decision, action: enginePlan.action ? { walkthroughId: enginePlan.action.walkthroughId, stepId: enginePlan.action.stepId, targetSelector: enginePlan.action.metadata?.targetSelector } : null });

        const plan = this.presenter.present(enginePlan);
        this.logStep("3. UI plan (presenter)", plan ? { message: plan.message?.slice(0, 60), stepId: plan.metadata?.stepId, targetSelector: plan.metadata?.targetSelector } : null);

        if (enginePlan.action) {
            const contextOnly = enginePlan.action.metadata?.contextOnly === true;
            const prevStepId = this.state.activeStepId;
            if (!contextOnly) {
                this.state.activeWalkthroughId = enginePlan.action.walkthroughId;
                this.state.activeStepId = enginePlan.action.stepId;
                this.state.updatedAt = Date.now();
            }

            // Organic advance: user clicked the target element; engine auto-completed the previous step
            // but we never emitted step_completed, so sync completedSteps for progress UI
            if (!contextOnly && event.type === "interaction.detected" && prevStepId && prevStepId !== enginePlan.action.stepId && !this.state.completedSteps.includes(prevStepId)) {
                this.state.completedSteps = [...(this.state.completedSteps || []), prevStepId];
                this.logStep("3b. Synced completedSteps (organic advance)", { added: prevStepId });
            }

            const stepRoute = enginePlan.action.metadata?.route;
            if (!contextOnly && typeof stepRoute === 'string' && stepRoute !== window.location.pathname) {
                this.logStep("4. Navigation requested", { stepRoute, currentPath: window.location.pathname });
                if (this.config.onNavigate) {
                    this.config.onNavigate(stepRoute);
                } else {
                    window.location.href = stepRoute;
                }
            }
        } else if (this.state.activeWalkthroughId) {
            const isStepEvent = (event as any).name === 'step_completed'
                || event.type === 'interaction.detected';

            if (isStepEvent) {
                this.logStep("5. Walkthrough completed (no next step)", { walkthroughId: this.state.activeWalkthroughId });
                this.handleWalkthroughCompleted(this.state.activeWalkthroughId);
                this.state.activeWalkthroughId = undefined as any;
                this.state.activeStepId = undefined as any;
            }
        }

        this.scheduleNotify(plan);
    }

    private handleWalkthroughCompleted(completedWalkthroughId: string) {
        console.log(`LumaWay SDK: Walkthrough completed: ${completedWalkthroughId}`);
        if (!this.state.completedWalkthroughs.includes(completedWalkthroughId)) {
            this.state.completedWalkthroughs = [...this.state.completedWalkthroughs, completedWalkthroughId];
        }

        // Find the walkthrough to get its title and next walkthrough
        const completedWT = this.walkthroughs.find(w => w.id === completedWalkthroughId);
        const title = (completedWT as any)?.title || 'Recorrido';
        const relatedSuggestions = this.getRelatedWalkthroughSuggestions(completedWalkthroughId);

        // Open chat after a short delay so tooltip can hide first
        setTimeout(() => {
            const wasOpen = this.assistant.isOpen;
            if (!wasOpen) {
                this.assistant.notifyUnread('Recorrido completado');
            }

            // Show completion state in progress panel
            const completedWT = this.walkthroughs.find(w => w.id === completedWalkthroughId) as any;
            if (completedWT) {
                const steps = (completedWT.steps || []).map((s: any) => ({ id: s.id, title: s.title || s.id }));
                this.assistant.updateWalkthroughProgress(completedWT.title || completedWalkthroughId, steps, [], null, true);
            }

            // Show completion celebration
            const completionMsg = `🎉 **¡${title} completado!**\nHas terminado todos los pasos del recorrido. ¡Excelente trabajo!`;
            this.assistant.addMessage('bot', completionMsg);

            // Ask if user wants more help and suggest coherent next walkthroughs
            if (relatedSuggestions.length > 0) {
                const relatedMsg = `¿Quieres que te ayude en algo más? Te puedo guiar en estos recorridos relacionados:`;
                const relatedActions = relatedSuggestions.map((item) => ({
                    label: `Seguir con ${item.title} →`,
                    walkthroughId: item.walkthroughId,
                    stepId: item.stepId,
                }));
                this.assistant.addMessage('bot', relatedMsg, relatedActions);
            } else {
                this.assistant.addMessage('bot', `¿Quieres que te ayude en algo más? Cuéntame qué necesitas y te guío paso a paso.`);
            }
        }, 600);
    }

    private getRelatedWalkthroughSuggestions(
        completedWalkthroughId: string
    ): Array<{ walkthroughId: string; stepId?: string; title: string }> {
        const completedWT = this.walkthroughs.find((w: any) => w.id === completedWalkthroughId) as any;
        if (!completedWT) return [];

        const completedSet = new Set(this.state.completedWalkthroughs || []);
        const candidates: Array<any> = [];
        const seen = new Set<string>();

        const pushCandidate = (wt: any) => {
            if (!wt?.id || wt.id === completedWalkthroughId || completedSet.has(wt.id) || seen.has(wt.id)) return;
            seen.add(wt.id);
            candidates.push(wt);
        };

        // 1) Next in explicit sequence has highest priority
        if (completedWT.nextWalkthroughId) {
            const nextWT = this.walkthroughs.find((w: any) => w.id === completedWT.nextWalkthroughId);
            if (nextWT) pushCandidate(nextWT);
        }

        // 2) Siblings under same parent context
        if (completedWT.parentId) {
            this.walkthroughs
                .filter((w: any) => w.parentId === completedWT.parentId)
                .forEach((w) => pushCandidate(w));
        }

        // 3) Same tags/context affinity
        const completedTags = new Set(((completedWT.tags || []) as string[]).map(t => String(t).toLowerCase()));
        if (completedTags.size > 0) {
            this.walkthroughs.forEach((w: any) => {
                const tags = ((w.tags || []) as string[]).map(t => String(t).toLowerCase());
                if (tags.some((t) => completedTags.has(t))) {
                    pushCandidate(w);
                }
            });
        }

        const suggestions: Array<{ walkthroughId: string; stepId?: string; title: string }> = [];
        for (const wt of candidates) {
            const firstStep = this.getFirstActionableStep(wt);
            if (!firstStep) continue;
            suggestions.push({
                walkthroughId: String(wt.id),
                stepId: firstStep.id,
                title: String(wt.title || wt.id),
            });
            if (suggestions.length >= 3) break;
        }

        return suggestions;
    }

    private getFirstActionableStep(walkthrough: any): { id: string } | null {
        const steps = Array.isArray(walkthrough?.steps) ? walkthrough.steps : [];
        const firstWithId = steps.find((s: any) => typeof s?.id === "string" && s.id);
        if (firstWithId) return { id: firstWithId.id };

        // Orchestrator fallback: try first child walkthrough with actionable step
        const firstChild = this.walkthroughs.find((w: any) => w.parentId === walkthrough?.id) as any;
        if (firstChild) return this.getFirstActionableStep(firstChild);
        return null;
    }

    private scheduleNotify(plan: GuidancePlan | null, forceRender = false) {
        this.pendingPlan = plan;
        this.pendingForceRender = this.pendingForceRender || forceRender;

        if (this.notifyTimer !== null) {
            globalThis.clearTimeout(this.notifyTimer);
        }

        this.notifyTimer = globalThis.setTimeout(() => {
            this.notifyTimer = null;
            const nextPlan = this.pendingPlan;
            const nextForce = this.pendingForceRender;
            this.pendingPlan = null;
            this.pendingForceRender = false;
            this.notify(nextPlan, nextForce);
        }, LumaSDK.UI_NOTIFY_DEBOUNCE_MS);
    }

    private notify(plan: GuidancePlan | null, forceRender = false) {
        // Fingerprint includes current route so that SPA navigation always re-renders
        // the tooltip even when the step plan hasn't changed (e.g. after navigating to
        // a step's route, navigation.change returns the same plan → must still re-render)
        const fingerprint = plan ? JSON.stringify({
            message: plan.message,
            suggestedAction: plan.suggestedAction,
            stepId: plan.metadata?.stepId,
            walkthroughId: plan.metadata?.walkthroughId,
            route: window.location.pathname,
        }) : `null:${window.location.pathname}`;

        if (!forceRender && fingerprint === this.lastPlan) {
            return;
        }

        this.lastPlan = fingerprint;
        const planWithConfig = plan ? { ...plan, config: this.projectConfig } : (this.projectConfig ? { message: "", canIgnore: true, config: this.projectConfig } as GuidancePlan : null);

        this.logStep("6. Notify", { hasPlan: !!plan, stepId: plan?.metadata?.stepId, walkthroughId: plan?.metadata?.walkthroughId });
        this.tooltip.render(planWithConfig);
        this.assistant.render(planWithConfig);

        // ── Update progress panel ──────────────────────────────────────────
        const activeWtId = plan?.metadata?.walkthroughId as string | undefined
            || this.state.activeWalkthroughId;
        if (activeWtId) {
            const wt = this.walkthroughs.find(w => (w as any).id === activeWtId) as any;
            if (wt) {
                const steps = (wt.steps || []).map((s: any) => ({ id: s.id, title: s.title || s.id }));
                const activeStepId = (plan?.metadata?.stepId as string) || this.state.activeStepId || null;
                this.assistant.updateWalkthroughProgress(
                    wt.title || activeWtId,
                    steps,
                    this.state.completedSteps || [],
                    activeStepId,
                    false
                );
            }
        } else {
            this.assistant.updateWalkthroughProgress(null, [], [], null, false);
        }

        this.subscribers.forEach((s) => s(planWithConfig));
    }

    private setupNavigationTracking() {
        const originalPushState = window.history.pushState;
        window.history.pushState = (...args) => {
            originalPushState.apply(window.history, args);
            this.pushIntentSignal("route", window.location.pathname);
            this.emitEvent({
                type: "navigation.change",
                route: window.location.pathname,
            });
        };

        window.addEventListener("popstate", () => {
            this.pushIntentSignal("route", window.location.pathname);
            this.emitEvent({
                type: "navigation.change",
                route: window.location.pathname,
            });
        });

        // Initial check
        this.pushIntentSignal("route", window.location.pathname);
        this.emitEvent({
            type: "navigation.change",
            route: window.location.pathname,
        });
    }

    public async trackIntent(intent: string) {
        this.logStep("trackIntent: send", { intent: intent.slice(0, 80) });
        this.pushIntentSignal("chat", intent);
        this.assistant.setTyping(true);
        let lastStreamPaintAt = 0;
        try {
            const response = await this.client.sendChatMessage(intent, {
                userId: this.context.userId,
                locale: this.context.locale,
            }, {
                onStatus: (status) => {
                    this.logStep("trackIntent: status", { status });
                },
                onChunk: (partial) => {
                    const now = Date.now();
                    if (now - lastStreamPaintAt < LumaSDK.STREAM_PAINT_THROTTLE_MS) return;
                    lastStreamPaintAt = now;
                    this.assistant.setStreamingBotMessage(partial);
                }
            });
            this.logStep("trackIntent: response", { message: response.message?.slice(0, 60), actionsCount: response.actions?.length ?? 0, executeWalkthrough: response.executeWalkthrough ?? null });

            // Show AI response with action buttons inside the bubble.
            // The walkthrough ONLY starts when the user explicitly clicks one of these buttons.
            // Do NOT auto-execute executeWalkthrough — that bypasses user intentionality.
            this.assistant.clearStreamingBotMessage();
            this.assistant.addMessage("bot", response.message, response.actions);

        } catch (error) {
            console.warn("LumaWay SDK: AI chat socket failed", error);
            this.assistant.clearStreamingBotMessage();
            this.assistant.addMessage(
                "bot",
                "No pude conectar el canal en tiempo real del chat. Verifica la conexión con el backend y vuelve a intentar."
            );
        } finally {
            this.assistant.clearStreamingBotMessage();
            this.assistant.setTyping(false);
        }
    }

    public async completeStep(walkthroughId: string, stepId: string) {
        this.logStep("completeStep", { walkthroughId, stepId });
        await this.emitEvent({
            type: "system.signal",
            name: "step_completed",
            payload: { walkthroughId, stepId }
        } as any);

        // Deterministic advance for explicit "Saltar/Siguiente" actions from tooltip.
        // This avoids UI getting stuck if resolver heuristics don't advance immediately.
        const wt = this.walkthroughs.find((w: any) => w.id === walkthroughId) as any;
        const steps = Array.isArray(wt?.steps) ? wt.steps : [];
        const currentIndex = steps.findIndex((s: any) => s.id === stepId);

        if (currentIndex >= 0 && currentIndex < steps.length - 1) {
            const nextStepId = steps[currentIndex + 1]?.id;
            if (nextStepId) {
                await this.emitEvent({
                    type: "step.next",
                    walkthroughId,
                    stepId: nextStepId,
                } as any);
            }
        } else if (currentIndex === steps.length - 1) {
            await this.emitEvent({
                type: "system.signal",
                name: "walkthrough_completed",
                payload: { walkthroughId },
            } as any);
        }
    }

    public async goToPreviousStep(walkthroughId: string, stepId: string) {
        this.logStep("previousStep", { walkthroughId, stepId });
        const wt = this.walkthroughs.find((w: any) => w.id === walkthroughId) as any;
        const steps = Array.isArray(wt?.steps) ? wt.steps : [];
        const currentIndex = steps.findIndex((s: any) => s.id === stepId);
        if (currentIndex <= 0) return;

        const prevStepId = steps[currentIndex - 1]?.id;
        if (!prevStepId) return;

        // Rewind progress from the target previous step onward, otherwise the resolver
        // sees that step as already completed and immediately jumps forward again.
        const rewindStepIds = new Set(
            steps
                .slice(currentIndex - 1)
                .map((s: any) => s?.id)
                .filter((id: any): id is string => typeof id === "string" && id.length > 0)
        );
        this.state.completedSteps = (this.state.completedSteps || []).filter((id) => !rewindStepIds.has(id));

        await this.emitEvent({
            type: "step.next",
            walkthroughId,
            stepId: prevStepId,
        } as any);
    }

    public startWalkthrough(walkthroughId: string, stepId?: string) {
        this.logStep("startWalkthrough", { walkthroughId, stepId });
        this.emitEvent({
            type: "system.signal",
            name: "start_walkthrough",
            payload: { walkthroughId, stepId }
        } as any);
    }

    private trackInteraction(selector: string) {
        if (selector && !selector.startsWith("#luma-") && !selector.includes("luma-tooltip") && !selector.includes("luma-assistant")) {
            this.pushIntentSignal("interaction", selector);
        }
        this.emitEvent({
            type: "interaction.detected",
            target: selector,
        } as any);
    }

    private normalizeIntentText(value: string): string {
        return String(value || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
    }

    private tokenizeIntentText(value: string): string[] {
        return this.normalizeIntentText(value)
            .split(/[^a-z0-9#/_-]+/g)
            .filter(Boolean)
            .filter((t) => t.length > 2);
    }

    private pushIntentSignal(source: "route" | "interaction" | "chat", value: string) {
        const normalized = this.normalizeIntentText(value);
        if (!normalized) return;

        if (source === "route") {
            this.recentRouteSignal = value;
        } else if (source === "interaction") {
            this.recentInteractionSignals = [value, ...this.recentInteractionSignals.filter((v) => v !== value)].slice(0, 8);
        } else {
            this.recentChatSignals = [value, ...this.recentChatSignals.filter((v) => v !== value)].slice(0, 6);
        }

        this.scheduleIntentSuggestions();
    }

    private scheduleIntentSuggestions() {
        const enabled = this.webMCPAvailable && this.webMCPConfig?.enabled !== false;
        if (!enabled) return;
        if (this.state.activeWalkthroughId) return; // avoid replacing guided-state UI

        if (this.intentSuggestTimer !== null) {
            globalThis.clearTimeout(this.intentSuggestTimer);
        }
        this.intentSuggestTimer = globalThis.setTimeout(() => {
            this.intentSuggestTimer = null;
            const actions = this.computeContextualWalkthroughSuggestions();
            this.assistant.setChatSuggestions(actions);
            this.logStep("intentuality.suggestions", {
                route: this.recentRouteSignal,
                interactions: this.recentInteractionSignals.slice(0, 2),
                chatSignals: this.recentChatSignals.slice(0, 2),
                suggestions: actions.map((a) => a.label),
            });
        }, LumaSDK.INTENT_SUGGEST_DEBOUNCE_MS);
    }

    private computeContextualWalkthroughSuggestions(): Array<{ label: string; walkthroughId?: string; stepId?: string }> {
        const route = this.normalizeIntentText(this.recentRouteSignal || window.location.pathname || "");
        const interactionSignals = this.recentInteractionSignals.map((s) => this.normalizeIntentText(s));
        const chatTerms = this.recentChatSignals.flatMap((s) => this.tokenizeIntentText(s));

        const scored = (this.walkthroughs as any[])
            .map((wt) => {
                const title = String(wt?.title || "");
                const desc = String(wt?.description || "");
                const tags = Array.isArray(wt?.tags) ? wt.tags.map((t: any) => String(t)).join(" ") : "";
                const steps = Array.isArray(wt?.steps) ? wt.steps : [];
                let score = 0;

                for (const step of steps) {
                    const stepRoute = this.normalizeIntentText(String(step?.metadata?.route || ""));
                    const stepTarget = this.normalizeIntentText(String(step?.target || ""));
                    const stepTitle = this.normalizeIntentText(String(step?.title || ""));
                    const stepDesc = this.normalizeIntentText(String(step?.description || step?.purpose || ""));

                    if (route && stepRoute) {
                        if (route === stepRoute) score += 14;
                        else if (route.startsWith(stepRoute) || stepRoute.startsWith(route)) score += 8;
                    }

                    if (stepTarget && interactionSignals.some((sig) => sig === stepTarget || sig.includes(stepTarget) || stepTarget.includes(sig))) {
                        score += 10;
                    }

                    for (const term of chatTerms) {
                        if (!term) continue;
                        if (stepTitle.includes(term) || stepDesc.includes(term)) score += 3;
                    }
                }

                const haystack = this.normalizeIntentText(`${title} ${desc} ${tags}`);
                for (const term of chatTerms) {
                    if (!term) continue;
                    if (haystack.includes(term)) score += 4;
                }

                const firstStep = this.getFirstActionableStep(wt);
                return {
                    wt,
                    score,
                    firstStepId: firstStep?.id,
                };
            })
            .filter((item) => item.firstStepId && item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

        return scored.map((item) => ({
            label: String(item.wt?.title || "Recorrido"),
            walkthroughId: String(item.wt?.id),
            stepId: String(item.firstStepId),
        }));
    }
}
