import type { Walkthrough } from "@luma/core";
import { io, type Socket } from "socket.io-client";

export interface LumaClientConfig {
    apiKey: string;
    apiUrl: string;
    locale?: string;
    actorSlug?: string;
    sessionId?: string;
    /** Chat transport mode. Default: socket-only */
    chatTransport?: "socket-only" | "socket-first" | "rest-only";
    onNavigate?: (route: string) => void;
    /** Enable verbose step-by-step logs (event, engine plan, UI plan). Use for debugging the AI agent flow. */
    debug?: boolean;
    /** Controlled API cache for REST resources (project/walkthroughs/versions). */
    cache?: {
        enabled?: boolean;
        projectStaleTimeMs?: number;
        walkthroughsStaleTimeMs?: number;
        versionsStaleTimeMs?: number;
    };
    audio?: {
        enabled?: boolean;
        volume?: number; // 0..1
    };
}

export interface ChatStreamCallbacks {
    onStatus?: (status: string) => void;
    onChunk?: (partial: string, chunk: string) => void;
}

export interface AssistFieldPlan {
    stepId: string;
    target: string;
    value: string;
    reason?: string;
    confidence?: number;
}

export interface AssistPlan {
    mode: "assist";
    summary?: string;
    needsConfirmation?: boolean;
    fields: AssistFieldPlan[];
}

export interface BrowserFlowPlan {
    mode: "runFlow";
    summary?: string;
    needsConfirmation?: boolean;
    steps: Array<{
        tool: BrowserMcpToolName;
        args?: Record<string, unknown>;
    }>;
}

export type BrowserMcpToolName =
    | "navigate"
    | "click"
    | "fill"
    | "select"
    | "waitFor"
    | "extractText"
    | "screenshot"
    | "runFlow";

export interface BrowserMcpResult<T = unknown> {
    ok: boolean;
    tool: BrowserMcpToolName;
    sessionId: string;
    data?: T;
    error?: string;
}

export interface ObserverCapturedEvent {
    type: "click" | "input" | "change" | "navigation" | "scroll" | "custom";
    timestampMs: number;
    url?: string;
    targetSelector?: string;
    label?: string;
    payload?: Record<string, unknown>;
}

interface CacheQuery {
    queryKey: readonly unknown[];
}

interface QueryClientLike {
    fetchQuery<T>(input: {
        queryKey: unknown[];
        queryFn: () => Promise<T>;
        staleTime?: number;
    }): Promise<T>;
    invalidateQueries(input: {
        queryKey?: unknown[];
        exact?: boolean;
        predicate?: (query: CacheQuery) => boolean;
    }): void;
    removeQueries(input: {
        queryKey?: unknown[];
        exact?: boolean;
        predicate?: (query: CacheQuery) => boolean;
    }): void;
}

class FallbackQueryClient implements QueryClientLike {
    private store = new Map<string, { key: unknown[]; data: unknown; updatedAt: number }>();

    private keyToString(key: unknown[]): string {
        return JSON.stringify(key);
    }

    private isPrefixKey(full: unknown[], prefix: unknown[]): boolean {
        if (prefix.length > full.length) return false;
        for (let i = 0; i < prefix.length; i += 1) {
            if (String(full[i]) !== String(prefix[i])) return false;
        }
        return true;
    }

    async fetchQuery<T>(input: {
        queryKey: unknown[];
        queryFn: () => Promise<T>;
        staleTime?: number;
    }): Promise<T> {
        const now = Date.now();
        const keyStr = this.keyToString(input.queryKey);
        const cached = this.store.get(keyStr);
        const staleTime = input.staleTime ?? 0;
        if (cached && now - cached.updatedAt <= staleTime) {
            return cached.data as T;
        }
        const data = await input.queryFn();
        this.store.set(keyStr, { key: input.queryKey, data, updatedAt: now });
        return data;
    }

    invalidateQueries(input: {
        queryKey?: unknown[];
        exact?: boolean;
        predicate?: (query: CacheQuery) => boolean;
    }): void {
        const entries = Array.from(this.store.entries());
        for (const [k, v] of entries) {
            const matchPredicate = input.predicate ? input.predicate({ queryKey: v.key }) : true;
            const matchKey = input.queryKey
                ? (input.exact
                    ? JSON.stringify(v.key) === JSON.stringify(input.queryKey)
                    : this.isPrefixKey(v.key, input.queryKey))
                : true;
            if (matchPredicate && matchKey) {
                this.store.delete(k);
            }
        }
    }

    removeQueries(input: {
        queryKey?: unknown[];
        exact?: boolean;
        predicate?: (query: CacheQuery) => boolean;
    }): void {
        this.invalidateQueries(input);
    }
}

export class LumaClient {
    private config: LumaClientConfig;
    private sessionId: string;
    private socket?: Socket;
    private socketInitialized = false;
    private lastSocketError: string | null = null;
    private lastHeartbeatAt: number | null = null;
    private heartbeatPingTimer: number | null = null;
    private queryClient: QueryClientLike;
    private browserSessionId?: string;

    constructor(config: LumaClientConfig) {
        this.config = config;
        this.sessionId = this.resolveSessionId(config);
        this.queryClient = new FallbackQueryClient();
        this.tryEnableTanstackQueryClient();
        this.initSocket();
    }

    private async tryEnableTanstackQueryClient() {
        try {
            const mod = await (0, eval)('import("@tanstack/query-core")');
            const TanstackQueryClient = mod?.QueryClient;
            if (TanstackQueryClient) {
                this.queryClient = new TanstackQueryClient({
                    defaultOptions: {
                        queries: {
                            retry: 1,
                            gcTime: 10 * 60 * 1000,
                        },
                    },
                }) as QueryClientLike;
            }
        } catch {
            // FallbackQueryClient remains active if TanStack is unavailable in current environment.
        }
    }

    private isCacheEnabled(): boolean {
        return this.config.cache?.enabled !== false;
    }

    private getProjectStaleTime(): number {
        return this.config.cache?.projectStaleTimeMs ?? 60_000;
    }

    private getWalkthroughsStaleTime(): number {
        return this.config.cache?.walkthroughsStaleTimeMs ?? 30_000;
    }

    private getVersionsStaleTime(): number {
        return this.config.cache?.versionsStaleTimeMs ?? 15_000;
    }

    private cacheScopeKey(): string[] {
        return [this.config.apiKey, this.config.actorSlug || "default", this.sessionId];
    }

    private projectQueryKey(): unknown[] {
        return ["luma", "client-project", ...this.cacheScopeKey()];
    }

    private walkthroughsQueryKey(): unknown[] {
        return ["luma", "client-walkthroughs", ...this.cacheScopeKey()];
    }

    private versionsQueryKey(walkthroughId: string): unknown[] {
        return ["luma", "client-walkthrough-versions", walkthroughId, ...this.cacheScopeKey()];
    }

    private isCurrentScopeQueryKey(queryKey: readonly unknown[]): boolean {
        const scope = this.cacheScopeKey();
        if (!Array.isArray(queryKey) || queryKey.length < scope.length + 2) return false;
        const tail = queryKey.slice(-scope.length).map((v) => String(v));
        return tail.join("::") === scope.join("::");
    }

    private getTransportMode(): "socket-only" | "socket-first" | "rest-only" {
        return this.config.chatTransport || "socket-only";
    }

    private async ensureSocketConnected(timeoutMs = 5000): Promise<Socket> {
        const socket = this.socket;
        if (!socket) {
            throw new Error("Socket transport unavailable");
        }
        if (socket.connected) return socket;

        await new Promise<void>((resolve, reject) => {
            const timer = globalThis.setTimeout(() => {
                cleanup();
                reject(new Error("Socket connection timeout"));
            }, timeoutMs);

            const onConnect = () => {
                cleanup();
                resolve();
            };
            const onError = (err?: any) => {
                cleanup();
                const reason = err?.message || err?.description || err?.type || "unknown";
                this.lastSocketError = String(reason);
                reject(new Error(`Socket connection error: ${reason}`));
            };
            const cleanup = () => {
                globalThis.clearTimeout(timer);
                socket.off("connect", onConnect);
                socket.off("connect_error", onError);
            };

            socket.on("connect", onConnect);
            socket.on("connect_error", onError);
            socket.connect();
        });

        return socket;
    }

    private async sendChatMessageRest(
        message: string,
        headers: Record<string, string>
    ): Promise<{
        message: string;
        walkthroughsUsed: number;
        executeWalkthrough?: {
            walkthroughId: string;
            stepId: string;
            autoStart: boolean;
        };
        actions?: Array<{ label: string; action?: string; walkthroughId?: string; stepId?: string }>;
        assistPlan?: AssistPlan;
        browserFlowPlan?: BrowserFlowPlan;
    }> {
        const response = await fetch(`${this.config.apiUrl}/ai-chat`, {
            method: "POST",
            headers,
            body: JSON.stringify({ message }),
        });

        if (!response.ok) {
            throw new Error(`LumaWay API Error: ${response.statusText}`);
        }

        return await response.json();
    }

    private initSocket() {
        if (this.socketInitialized || typeof window === "undefined") return;
        this.socketInitialized = true;
        try {
            this.socket = io(this.config.apiUrl, {
                transports: ["websocket", "polling"],
                withCredentials: true,
                timeout: 10000,
                autoConnect: true,
                reconnection: true,
                reconnectionAttempts: 6,
                reconnectionDelay: 500,
                reconnectionDelayMax: 2500,
            });
            this.socket.on("connect", () => {
                this.lastHeartbeatAt = Date.now();
                if (this.heartbeatPingTimer) {
                    globalThis.clearInterval(this.heartbeatPingTimer);
                }
                this.heartbeatPingTimer = globalThis.setInterval(() => {
                    this.socket?.emit("luma:heartbeat:ping");
                }, 10000);
            });
            this.socket.on("connect_error", (err: any) => {
                const reason = err?.message || err?.description || err?.type || "unknown";
                this.lastSocketError = String(reason);
                console.warn("LumaWay SDK: Socket connect_error", reason);
            });
            this.socket.on("luma:heartbeat", () => {
                this.lastHeartbeatAt = Date.now();
            });
            this.socket.on("luma:heartbeat:pong", () => {
                this.lastHeartbeatAt = Date.now();
            });
            this.socket.on("disconnect", () => {
                if (this.heartbeatPingTimer) {
                    globalThis.clearInterval(this.heartbeatPingTimer);
                    this.heartbeatPingTimer = null;
                }
            });
        } catch (error) {
            console.warn("LumaWay SDK: Socket init failed, using REST fallback", error);
            this.socket = undefined;
        }
    }

    getSocketDiagnostics(): { connected: boolean; lastError?: string; lastHeartbeatAt?: number } {
        return {
            connected: Boolean(this.socket?.connected),
            ...(this.lastSocketError ? { lastError: this.lastSocketError } : {}),
            ...(this.lastHeartbeatAt ? { lastHeartbeatAt: this.lastHeartbeatAt } : {}),
        };
    }

    private resolveSessionId(config: LumaClientConfig): string {
        if (config.sessionId && config.sessionId.trim()) {
            return config.sessionId.trim();
        }
        if (typeof window === "undefined" || !window.sessionStorage) {
            return crypto.randomUUID();
        }

        const actor = config.actorSlug || "default";
        const key = `luma:session:${config.apiKey}:${actor}`;
        const existing = window.sessionStorage.getItem(key);
        if (existing && existing.trim()) return existing.trim();

        const created = crypto.randomUUID();
        window.sessionStorage.setItem(key, created);
        return created;
    }

    async fetchWalkthroughs(): Promise<Walkthrough[]> {
        const headers: Record<string, string> = {
            "x-api-key": this.config.apiKey,
            "x-luma-session-id": this.sessionId,
        };

        if (this.config.actorSlug) {
            headers["x-actor-slug"] = this.config.actorSlug;
        }

        const fetcher = async () => {
            const response = await fetch(`${this.config.apiUrl}/client-walkthroughs`, {
                headers,
            });
            if (!response.ok) {
                throw new Error(`LumaWay API Error: ${response.statusText}`);
            }
            return await response.json();
        };

        try {
            if (!this.isCacheEnabled()) {
                return await fetcher();
            }
            return await this.queryClient.fetchQuery({
                queryKey: this.walkthroughsQueryKey(),
                queryFn: fetcher,
                staleTime: this.getWalkthroughsStaleTime(),
            });
        } catch (error) {
            console.error("LumaWay SDK: Failed to fetch walkthroughs", error);
            return [];
        }
    }

    async fetchVersions(walkthroughId: string): Promise<any[]> {
        const headers: Record<string, string> = {
            "x-api-key": this.config.apiKey,
            "x-luma-session-id": this.sessionId,
        };

        const fetcher = async () => {
            const response = await fetch(
                `${this.config.apiUrl}/client-walkthrough-versions?walkthroughId=${walkthroughId}`,
                { headers }
            );
            if (!response.ok) {
                throw new Error(`LumaWay API Error: ${response.statusText}`);
            }
            return await response.json();
        };

        try {
            if (!this.isCacheEnabled()) {
                return await fetcher();
            }
            return await this.queryClient.fetchQuery({
                queryKey: this.versionsQueryKey(walkthroughId),
                queryFn: fetcher,
                staleTime: this.getVersionsStaleTime(),
            });
        } catch (error) {
            console.error(
                `LumaWay SDK: Failed to fetch versions for ${walkthroughId}`,
                error
            );
            return [];
        }
    }

    async fetchProjectConfig(): Promise<any> {
        const headers: Record<string, string> = {
            "x-api-key": this.config.apiKey,
            "x-luma-session-id": this.sessionId,
        };

        const fetcher = async () => {
            const response = await fetch(`${this.config.apiUrl}/client-project`, {
                headers,
            });
            if (!response.ok) {
                throw new Error(`LumaWay API Error: ${response.statusText}`);
            }
            return await response.json();
        };

        try {
            if (!this.isCacheEnabled()) {
                return await fetcher();
            }
            return await this.queryClient.fetchQuery({
                queryKey: this.projectQueryKey(),
                queryFn: fetcher,
                staleTime: this.getProjectStaleTime(),
            });
        } catch (error: any) {
            console.warn("LumaWay SDK: Failed to fetch project config", error?.message || error);
            return null;
        }
    }

    async startObserverSession(intent?: string): Promise<{ observerSessionId: string; lumenId?: string; status: string; startedAt: string }> {
        const response = await fetch(`${this.config.apiUrl}/client-observer-sessions`, {
            method: "POST",
            headers: {
                "x-api-key": this.config.apiKey,
                "Content-Type": "application/json",
                "x-luma-session-id": this.sessionId,
            },
            body: JSON.stringify({
                action: "start",
                intent: intent || null,
            }),
        });

        if (!response.ok) {
            throw new Error(`Lumen start failed: ${response.statusText}`);
        }

        return await response.json();
    }

    async signObserverUpload(filename: string): Promise<{ signedUrl: string; s3Key: string; lumenS3Key?: string; headers?: Record<string, string> }> {
        const response = await fetch(`${this.config.apiUrl}/client-observer-sessions`, {
            method: "POST",
            headers: {
                "x-api-key": this.config.apiKey,
                "Content-Type": "application/json",
                "x-luma-session-id": this.sessionId,
            },
            body: JSON.stringify({
                action: "signUpload",
                filename,
            }),
        });

        if (!response.ok) {
            throw new Error(`Lumen upload signing failed: ${response.statusText}`);
        }

        return await response.json();
    }

    async ingestObserverEvents(observerSessionId: string, events: ObserverCapturedEvent[]): Promise<{ observerSessionId: string; lumenId?: string; ingested: number }> {
        const response = await fetch(`${this.config.apiUrl}/client-observer-sessions`, {
            method: "POST",
            headers: {
                "x-api-key": this.config.apiKey,
                "Content-Type": "application/json",
                "x-luma-session-id": this.sessionId,
            },
            body: JSON.stringify({
                action: "events",
                observerSessionId,
                events,
            }),
        });

        if (!response.ok) {
            throw new Error(`Lumen events ingest failed: ${response.statusText}`);
        }

        return await response.json();
    }

    async finalizeObserverSession(
        observerSessionId: string,
        input: { videoS3Key?: string; lumenS3Key?: string; videoDurationMs?: number; captureSource?: "dom" | "webmcp" | "hybrid" | "unknown" }
    ): Promise<{ observerSessionId: string; lumenId?: string; status: string; captureSource?: "dom" | "webmcp" | "hybrid" | "unknown"; videoS3Key?: string; lumenS3Key?: string }> {
        const response = await fetch(`${this.config.apiUrl}/client-observer-sessions`, {
            method: "POST",
            headers: {
                "x-api-key": this.config.apiKey,
                "Content-Type": "application/json",
                "x-luma-session-id": this.sessionId,
            },
            body: JSON.stringify({
                action: "finalize",
                observerSessionId,
                videoS3Key: input.videoS3Key || input.lumenS3Key || null,
                captureSource: input.captureSource || "dom",
                videoDurationMs: input.videoDurationMs ?? null,
            }),
        });

        if (!response.ok) {
            throw new Error(`Lumen finalize failed: ${response.statusText}`);
        }

        return await response.json();
    }

    // Public conceptual aliases: videos generated in training are "Lumens".
    async startLumen(intent?: string) {
        return this.startObserverSession(intent);
    }

    async signLumenUpload(filename: string) {
        return this.signObserverUpload(filename);
    }

    async ingestLumenEvents(lumenId: string, events: ObserverCapturedEvent[]) {
        return this.ingestObserverEvents(lumenId, events);
    }

    async finalizeLumen(
        lumenId: string,
        input: { lumenS3Key?: string; videoS3Key?: string; videoDurationMs?: number; captureSource?: "dom" | "webmcp" | "hybrid" | "unknown" }
    ) {
        return this.finalizeObserverSession(lumenId, input);
    }

    invalidateApiCache(scope: "all" | "project" | "walkthroughs" | "versions" = "all", walkthroughId?: string) {
        if (!this.isCacheEnabled()) return;
        if (scope === "all") {
            this.queryClient.invalidateQueries({
                predicate: (query) => this.isCurrentScopeQueryKey(query.queryKey),
            });
            return;
        }
        if (scope === "project") {
            this.queryClient.invalidateQueries({ queryKey: this.projectQueryKey(), exact: true });
            return;
        }
        if (scope === "walkthroughs") {
            this.queryClient.invalidateQueries({ queryKey: this.walkthroughsQueryKey(), exact: true });
            return;
        }
        if (scope === "versions") {
            if (walkthroughId) {
                this.queryClient.invalidateQueries({ queryKey: this.versionsQueryKey(walkthroughId), exact: true });
            } else {
                this.queryClient.invalidateQueries({
                    predicate: (query) =>
                        Array.isArray(query.queryKey)
                        && String(query.queryKey[0]) === "luma"
                        && String(query.queryKey[1]) === "client-walkthrough-versions"
                        && this.isCurrentScopeQueryKey(query.queryKey),
                });
            }
        }
    }

    clearApiCache() {
        this.queryClient.removeQueries({
            predicate: (query) => this.isCurrentScopeQueryKey(query.queryKey),
        });
    }

    async sendChatMessage(
        message: string,
        userContext?: { userId?: string; locale?: string },
        streamCallbacks?: ChatStreamCallbacks
    ): Promise<{
        message: string;
        walkthroughsUsed: number;
        executeWalkthrough?: {
            walkthroughId: string;
            stepId: string;
            autoStart: boolean;
        };
        actions?: Array<{ label: string; action?: string; walkthroughId?: string; stepId?: string }>;
        assistPlan?: AssistPlan;
        browserFlowPlan?: BrowserFlowPlan;
    }> {
        const headers: Record<string, string> = {
            "x-api-key": this.config.apiKey,
            "Content-Type": "application/json",
            "x-luma-session-id": this.sessionId,
        };

        if (this.config.actorSlug) {
            headers["x-actor-slug"] = this.config.actorSlug;
        }
        if (userContext?.userId) {
            headers["x-luma-user-id"] = userContext.userId;
        }
        if (userContext?.locale) {
            headers["x-luma-locale"] = userContext.locale;
        }

        const transportMode = this.getTransportMode();
        if (transportMode === "rest-only") {
            return this.sendChatMessageRest(message, headers);
        }

        let socket: Socket;
        try {
            socket = await this.ensureSocketConnected(5000);
        } catch (error) {
            if (transportMode === "socket-first") {
                return this.sendChatMessageRest(message, headers);
            }
            throw error;
        }

        if (socket) {
            const requestId = crypto.randomUUID();
            let lastPartial = "";
            const socketResponse = await new Promise<{
                message: string;
                walkthroughsUsed: number;
                executeWalkthrough?: {
                    walkthroughId: string;
                    stepId: string;
                    autoStart: boolean;
                };
                actions?: Array<{ label: string; action?: string; walkthroughId?: string; stepId?: string }>;
                assistPlan?: AssistPlan;
                browserFlowPlan?: BrowserFlowPlan;
            }>((resolve, reject) => {
                let timeout: number | undefined;
                const armTimeout = (ms = 45000) => {
                    if (timeout) globalThis.clearTimeout(timeout);
                    timeout = globalThis.setTimeout(() => {
                        cleanup();
                        reject(new Error("Socket chat timeout"));
                    }, ms);
                };
                armTimeout(45000);

                const onResult = (payload: any) => {
                    if (!payload || payload.requestId !== requestId) return;
                    cleanup();
                    resolve(payload.result ?? null);
                };
                const onStatus = (payload: any) => {
                    if (!payload || payload.requestId !== requestId) return;
                    armTimeout(45000);
                    if (typeof payload.status === "string") {
                        streamCallbacks?.onStatus?.(payload.status);
                    }
                };
                const onChunk = (payload: any) => {
                    if (!payload || payload.requestId !== requestId) return;
                    armTimeout(45000);
                    const partial = typeof payload.partial === "string" ? payload.partial : "";
                    const chunk = typeof payload.chunk === "string" ? payload.chunk : "";
                    if (partial) lastPartial = partial;
                    streamCallbacks?.onChunk?.(partial, chunk);
                };
                const onError = (payload: any) => {
                    if (!payload || payload.requestId !== requestId) return;
                    cleanup();
                    reject(new Error(payload.error || "Socket chat error"));
                };
                const cleanup = () => {
                    if (timeout) globalThis.clearTimeout(timeout);
                    socket.off("ai-chat:result", onResult);
                    socket.off("ai-chat:status", onStatus);
                    socket.off("ai-chat:chunk", onChunk);
                    socket.off("ai-chat:error", onError);
                };

                socket.on("ai-chat:result", onResult);
                socket.on("ai-chat:status", onStatus);
                socket.on("ai-chat:chunk", onChunk);
                socket.on("ai-chat:error", onError);
                socket.emit("ai-chat:send", {
                    requestId,
                    message,
                    headers,
                });
            });

            if (socketResponse && typeof socketResponse.message === "string") {
                const msg = socketResponse.message.trim();
                const partial = lastPartial.trim();
                const looksCut = msg.length > 0 && !/[.!?…:)]$/.test(msg) && partial.length > msg.length + 8;
                const normalizeTail = (value: string): string => {
                    let out = value.trim();
                    if (/[¿¡([{:"'\-–—]\s*$/.test(out)) {
                        out = out.replace(/[¿¡([{:"'\-–—]\s*$/, "").trim();
                    }
                    if (out && !/[.!?…]$/.test(out)) out += ".";
                    return out;
                };
                if (!msg || looksCut) {
                    socketResponse.message = normalizeTail(partial || msg);
                } else {
                    socketResponse.message = normalizeTail(msg);
                }
            }

            return socketResponse;
        }

        throw new Error("Socket transport unavailable");
    }

    async callBrowserMcpTool(
        tool: BrowserMcpToolName,
        args: Record<string, unknown> = {},
        sessionId?: string
    ): Promise<BrowserMcpResult> {
        const timeoutMs = tool === "runFlow" ? 120000 : 30000;
        const attempts = tool === "runFlow" ? 3 : 2;
        const usedSessionId = sessionId || this.browserSessionId;
        let lastError: Error | null = null;

        for (let i = 1; i <= attempts; i += 1) {
            try {
                const socket = await this.ensureSocketConnected(5000);
                const requestId = crypto.randomUUID();
                const result = await new Promise<BrowserMcpResult>((resolve, reject) => {
                    const timeout = globalThis.setTimeout(() => {
                        cleanup();
                        reject(new Error("Browser MCP timeout"));
                    }, timeoutMs);

                    const onResult = (payload: any) => {
                        if (!payload || payload.requestId !== requestId) return;
                        cleanup();
                        resolve(payload.result ?? null);
                    };
                    const onError = (payload: any) => {
                        if (!payload || payload.requestId !== requestId) return;
                        cleanup();
                        reject(new Error(payload.error || "Browser MCP error"));
                    };
                    const cleanup = () => {
                        globalThis.clearTimeout(timeout);
                        socket.off("browser-mcp:result", onResult);
                        socket.off("browser-mcp:error", onError);
                    };

                    socket.on("browser-mcp:result", onResult);
                    socket.on("browser-mcp:error", onError);
                    socket.emit("browser-mcp:tool", {
                        requestId,
                        sessionId: usedSessionId,
                        tool,
                        args,
                    });
                });
                if (result?.sessionId) {
                    this.browserSessionId = result.sessionId;
                }
                return result;
            } catch (error: any) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (i < attempts) {
                    await new Promise((r) => globalThis.setTimeout(r, 300 * i));
                }
            }
        }

        throw lastError || new Error("Browser MCP failed after retries");
    }
}
