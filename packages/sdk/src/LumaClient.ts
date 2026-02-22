import type { Walkthrough } from "@luma/core";
import { io, type Socket } from "socket.io-client";

export interface LumaClientConfig {
    apiKey: string;
    apiUrl: string;
    actorSlug?: string;
    sessionId?: string;
    /** Chat transport mode. Default: socket-only */
    chatTransport?: "socket-only" | "socket-first" | "rest-only";
    onNavigate?: (route: string) => void;
    /** Enable verbose step-by-step logs (event, engine plan, UI plan). Use for debugging the AI agent flow. */
    debug?: boolean;
}

export interface ChatStreamCallbacks {
    onStatus?: (status: string) => void;
    onChunk?: (partial: string, chunk: string) => void;
}

export class LumaClient {
    private config: LumaClientConfig;
    private sessionId: string;
    private socket?: Socket;
    private socketInitialized = false;

    constructor(config: LumaClientConfig) {
        this.config = config;
        this.sessionId = this.resolveSessionId(config);
        this.initSocket();
    }

    private getTransportMode(): "socket-only" | "socket-first" | "rest-only" {
        return this.config.chatTransport || "socket-only";
    }

    private async ensureSocketConnected(timeoutMs = 1500): Promise<Socket> {
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
            const onError = () => {
                cleanup();
                reject(new Error("Socket connection error"));
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
                timeout: 2500,
                autoConnect: true,
            });
        } catch (error) {
            console.warn("LumaWay SDK: Socket init failed, using REST fallback", error);
            this.socket = undefined;
        }
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

        try {
            const response = await fetch(`${this.config.apiUrl}/client-walkthroughs`, {
                headers,
            });

            if (!response.ok) {
                throw new Error(`LumaWay API Error: ${response.statusText}`);
            }

            return await response.json();
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

        try {
            const response = await fetch(
                `${this.config.apiUrl}/client-walkthrough-versions?walkthroughId=${walkthroughId}`,
                { headers }
            );

            if (!response.ok) {
                throw new Error(`LumaWay API Error: ${response.statusText}`);
            }

            return await response.json();
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

        try {
            const response = await fetch(`${this.config.apiUrl}/client-project`, {
                headers,
            });

            if (!response.ok) {
                console.warn(`LumaWay SDK: Failed to fetch project config (${response.status})`);
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error("LumaWay SDK: Error fetching project config", error);
            return null;
        }
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
            socket = await this.ensureSocketConnected(1500);
        } catch (error) {
            if (transportMode === "socket-first") {
                return this.sendChatMessageRest(message, headers);
            }
            throw error;
        }

        if (socket) {
            const requestId = crypto.randomUUID();
            const socketResponse = await new Promise<{
                message: string;
                walkthroughsUsed: number;
                executeWalkthrough?: {
                    walkthroughId: string;
                    stepId: string;
                    autoStart: boolean;
                };
                actions?: Array<{ label: string; action?: string; walkthroughId?: string; stepId?: string }>;
            }>((resolve, reject) => {
                const timeout = globalThis.setTimeout(() => {
                    cleanup();
                    reject(new Error("Socket chat timeout"));
                }, 10000);

                const onResult = (payload: any) => {
                    if (!payload || payload.requestId !== requestId) return;
                    cleanup();
                    resolve(payload.result ?? null);
                };
                const onStatus = (payload: any) => {
                    if (!payload || payload.requestId !== requestId) return;
                    if (typeof payload.status === "string") {
                        streamCallbacks?.onStatus?.(payload.status);
                    }
                };
                const onChunk = (payload: any) => {
                    if (!payload || payload.requestId !== requestId) return;
                    const partial = typeof payload.partial === "string" ? payload.partial : "";
                    const chunk = typeof payload.chunk === "string" ? payload.chunk : "";
                    streamCallbacks?.onChunk?.(partial, chunk);
                };
                const onError = (payload: any) => {
                    if (!payload || payload.requestId !== requestId) return;
                    cleanup();
                    reject(new Error(payload.error || "Socket chat error"));
                };
                const cleanup = () => {
                    globalThis.clearTimeout(timeout);
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

            return socketResponse;
        }

        throw new Error("Socket transport unavailable");
    }
}
