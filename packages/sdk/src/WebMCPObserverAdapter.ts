import type { ObserverCapturedEvent } from "./LumaClient.js";

type WebMCPTool = { name?: string };
type WebMCPBridge = {
    callTool: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
    listTools?: () => Promise<WebMCPTool[]>;
};

type AdapterOptions = {
    onEvent: (event: ObserverCapturedEvent) => void;
    isInternalSelector: (selector?: string) => boolean;
    getStartedAt: () => number;
};

type StartResult = {
    active: boolean;
    mode: "tool" | "window-events" | "hybrid" | "none";
};

export class WebMCPObserverAdapter {
    private readonly options: AdapterOptions;
    private readonly bridge: WebMCPBridge | null;
    private readonly cleanupFns: Array<() => void> = [];
    private toolNames: string[] = [];
    private pollTimer: number | null = null;
    private sessionId: string | null = null;
    private cursor: string | null = null;
    private startToolName: string | null = null;
    private stopToolName: string | null = null;
    private pullToolName: string | null = null;
    private pulledEvents = 0;

    constructor(options: AdapterOptions) {
        this.options = options;
        if (typeof window === "undefined") {
            this.bridge = null;
            return;
        }
        const maybeBridge = (window as any).mcp as WebMCPBridge | undefined;
        this.bridge = maybeBridge && typeof maybeBridge.callTool === "function" ? maybeBridge : null;
    }

    async start(): Promise<StartResult> {
        if (!this.bridge) {
            return { active: false, mode: "none" };
        }

        await this.discoverTools();
        this.resolveToolNames();
        const eventBridgeActive = this.attachWindowEventBridge();
        const toolActive = await this.startToolCapture();
        const pullActive = this.startPullPolling();

        if (toolActive && (eventBridgeActive || pullActive)) {
            return { active: true, mode: "hybrid" };
        }
        if (toolActive || pullActive) {
            return { active: true, mode: "tool" };
        }
        if (eventBridgeActive) {
            return { active: true, mode: "window-events" };
        }
        return { active: false, mode: "none" };
    }

    async stop(): Promise<void> {
        if (this.pollTimer !== null) {
            window.clearInterval(this.pollTimer);
            this.pollTimer = null;
        }

        if (this.bridge && this.stopToolName) {
            try {
                await this.bridge.callTool(this.stopToolName, this.sessionId ? { sessionId: this.sessionId } : {});
            } catch {
                // Soft-fail: DOM fallback may still have captured events.
            }
        }

        for (const fn of this.cleanupFns) fn();
        this.cleanupFns.length = 0;
        this.sessionId = null;
        this.cursor = null;
    }

    getStats() {
        return { pulledEvents: this.pulledEvents };
    }

    private async discoverTools(): Promise<void> {
        this.toolNames = [];
        if (!this.bridge || typeof this.bridge.listTools !== "function") return;
        try {
            const tools = await this.bridge.listTools();
            this.toolNames = Array.isArray(tools)
                ? tools.map((tool) => String(tool?.name || "")).filter(Boolean)
                : [];
        } catch {
            this.toolNames = [];
        }
    }

    private resolveToolNames() {
        const starts = ["web.observe.start", "observer.start", "web.observer.start", "web.capture.start"];
        const stops = ["web.observe.stop", "observer.stop", "web.observer.stop", "web.capture.stop"];
        const pulls = ["web.observe.pull", "observer.pull", "web.observer.pull", "web.capture.pull"];

        this.startToolName = this.pickTool(starts);
        this.stopToolName = this.pickTool(stops);
        this.pullToolName = this.pickTool(pulls);
    }

    private pickTool(candidates: string[]): string | null {
        if (!this.toolNames.length) return null;
        const exact = candidates.find((name) => this.toolNames.includes(name));
        if (exact) return exact;

        for (const tool of this.toolNames) {
            const normalized = tool.toLowerCase();
            if (candidates.some((candidate) => normalized.endsWith(candidate.toLowerCase()))) {
                return tool;
            }
        }
        return null;
    }

    private async startToolCapture(): Promise<boolean> {
        if (!this.bridge || !this.startToolName) return false;
        try {
            const result = await this.bridge.callTool(this.startToolName, {
                events: ["click", "change", "scroll", "navigation"],
                includeSelector: true,
                includeLabel: true,
                includeUrl: true,
            });
            const payload = this.asObject(result);
            const sessionId = payload?.sessionId || payload?.observerSessionId || payload?.id;
            if (typeof sessionId === "string" && sessionId.trim()) {
                this.sessionId = sessionId;
            }
            return true;
        } catch {
            return false;
        }
    }

    private startPullPolling(): boolean {
        if (!this.bridge || !this.pullToolName || typeof window === "undefined") return false;

        const poll = async () => {
            try {
                const result = await this.bridge!.callTool(this.pullToolName!, {
                    ...(this.sessionId ? { sessionId: this.sessionId } : {}),
                    ...(this.cursor ? { cursor: this.cursor } : {}),
                    limit: 200,
                });
                const payload = this.asObject(result);
                if (typeof payload?.cursor === "string") {
                    this.cursor = payload.cursor;
                }
                const events = this.extractEvents(payload);
                if (!events.length) return;
                for (const raw of events) {
                    const mapped = this.mapRawEvent(raw);
                    if (!mapped) continue;
                    this.pulledEvents += 1;
                    this.options.onEvent(mapped);
                }
            } catch {
                // Ignore polling errors: bridge may be intermittent.
            }
        };

        this.pollTimer = window.setInterval(() => {
            void poll();
        }, 1000);

        void poll();
        return true;
    }

    private attachWindowEventBridge(): boolean {
        if (typeof window === "undefined") return false;

        const names = [
            "webmcp:observer-event",
            "webmcp:observation",
            "webmcp:event",
            "mcp:observer-event",
            "mcp:event",
        ];

        let attached = false;
        for (const name of names) {
            const handler = (evt: Event) => {
                const custom = evt as CustomEvent;
                const detail = this.asObject(custom.detail);
                const mapped = this.mapRawEvent(detail);
                if (!mapped) return;
                this.options.onEvent(mapped);
            };
            window.addEventListener(name, handler as EventListener);
            this.cleanupFns.push(() => window.removeEventListener(name, handler as EventListener));
            attached = true;
        }
        return attached;
    }

    private mapRawEvent(raw: unknown): ObserverCapturedEvent | null {
        const payload = this.asObject(raw);
        if (!payload) return null;

        const type = String(payload.type || payload.eventType || payload.name || "").toLowerCase();
        const normalizedType =
            type.includes("click") ? "click"
                : type.includes("change") || type.includes("input") ? "change"
                    : type.includes("scroll") ? "scroll"
                        : type.includes("nav") || type.includes("route") ? "navigation"
                            : "";
        if (!normalizedType) return null;

        const selector = String(payload.targetSelector || payload.selector || payload.target || "").trim() || undefined;
        if (this.options.isInternalSelector(selector)) return null;

        const timestampMs = this.resolveTimestamp(payload);
        const url = String(payload.url || payload.path || window.location.pathname + window.location.search);
        const label = this.resolveLabel(payload);

        const event: ObserverCapturedEvent = {
            type: normalizedType as ObserverCapturedEvent["type"],
            timestampMs,
            url,
            ...(selector ? { targetSelector: selector } : {}),
            ...(label ? { label } : {}),
        };

        const extraPayload = this.resolvePayload(payload);
        if (extraPayload) {
            event.payload = extraPayload;
        }

        return event;
    }

    private resolveTimestamp(payload: Record<string, unknown>): number {
        if (typeof payload.timestampMs === "number") return Math.max(0, payload.timestampMs);
        if (typeof payload.timestamp === "number") return Math.max(0, payload.timestamp - this.options.getStartedAt());
        if (typeof payload.ts === "number") return Math.max(0, payload.ts - this.options.getStartedAt());
        return Math.max(0, Date.now() - this.options.getStartedAt());
    }

    private resolveLabel(payload: Record<string, unknown>): string | undefined {
        const label = payload.label || payload.text || payload.ariaLabel || "";
        const normalized = String(label || "").trim();
        return normalized ? normalized.slice(0, 120) : undefined;
    }

    private resolvePayload(payload: Record<string, unknown>): Record<string, unknown> | undefined {
        if (payload.payload && typeof payload.payload === "object" && payload.payload !== null) {
            return payload.payload as Record<string, unknown>;
        }
        const data = payload.data;
        if (data && typeof data === "object") return data as Record<string, unknown>;
        return undefined;
    }

    private extractEvents(payload: Record<string, unknown> | null): unknown[] {
        if (!payload) return [];
        if (Array.isArray(payload.events)) return payload.events;
        if (Array.isArray(payload.items)) return payload.items;
        if (Array.isArray(payload.data)) return payload.data;
        return [];
    }

    private asObject(input: unknown): Record<string, any> | null {
        if (!input || typeof input !== "object") return null;
        return input as Record<string, any>;
    }
}
