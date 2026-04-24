import { LumaEngine } from "@luma/engine";
import { LumaPresenter } from "@luma/presenters";
import type {
    ExecutionState,
    GuidancePlan,
    LumaEvent,
    LumaUserContext,
    Walkthrough
} from "./public-types.js";
import { LumaClient } from "./LumaClient.js";
import type { AssistPlan, BrowserFlowPlan, LumaClientConfig, ObserverCapturedEvent } from "./LumaClient.js";
import { Tooltip } from "./ui/Tooltip.js";
import { Assistant, type ChatMessage } from "./ui/Assistant.js";
import { AutomationOverlay } from "./ui/AutomationOverlay.js";
import { InteractionObserver } from "./InteractionObserver.js";
import { AudioCueEngine } from "./AudioCueEngine.js";
import { WebMCPObserverAdapter } from "./WebMCPObserverAdapter.js";
import { resolveSdkStrings, type SdkI18nStrings } from "./i18n.js";

/** Persisted chat history by session key (apiKey:userId) so it survives SDK/Assistant re-creation. */
const messageHistoryStore: Record<string, ChatMessage[]> = {};

function getHistoryKey(apiKey: string, userId?: string): string {
    return `${apiKey}:${userId || "anonymous"}`;
}

type ObserverStartOptions = {
    captureSystemAudio: boolean;
    captureMicrophone: boolean;
    captureCamera: boolean;
};

type ObserverIconName =
    | "spark"
    | "monitor"
    | "camera"
    | "microphone"
    | "help"
    | "home"
    | "stop"
    | "pause"
    | "play"
    | "restart"
    | "keyboard"
    | "trash";

export class LumaSDK {
    private static readonly UI_NOTIFY_DEBOUNCE_MS = 120;
    private static readonly STREAM_PAINT_THROTTLE_MS = 50;
    private static readonly INTENT_SUGGEST_DEBOUNCE_MS = 180;
    private config: LumaClientConfig;
    // Typed as `any` to keep internal engine/presenter classes out of the
    // published .d.ts (they are private implementation details).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private engine: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private presenter: any;
    private client: LumaClient;
    private state: ExecutionState;
    private context: LumaUserContext;
    private walkthroughs: Walkthrough[] = [];
    private projectConfig: any = null;
    private tooltip: Tooltip;
    private assistant: Assistant;
    private automationOverlay: AutomationOverlay;
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
    private pendingAssistPlan: AssistPlan | null = null;
    private pendingBrowserFlowPlan: BrowserFlowPlan | null = null;
    private automationPaused = false;
    private automationStopped = false;
    private authorizeResolver: ((ok: boolean) => void) | null = null;
    private suppressInteractionEvents = false;
    private autoCursorEl: HTMLElement | null = null;
    private autoCursorVisible = false;
    private authorizationFocusEl: HTMLElement | null = null;
    private audio: AudioCueEngine;
    private strings: SdkI18nStrings;
    private thinkingCueTimer: number | null = null;
    private uiTheme: "light" | "dark" = "light";
    private lastTrackedIntent: { text: string; at: number } | null = null;
    private automationInFlight = false;
    private automationCooldownUntil = 0;
    private webMCPDiagnostics: {
        bridgeDetected: boolean;
        webFillAvailable: boolean;
        checkedAt: number;
    } = {
            bridgeDetected: false,
            webFillAvailable: false,
        checkedAt: 0,
    };
    private observerEnabled = false;
    private observerButton: HTMLButtonElement | null = null;
    private observerSessionId: string | null = null;
    private observerMediaRecorder: MediaRecorder | null = null;
    private observerMediaStream: MediaStream | null = null;
    private observerMicStream: MediaStream | null = null;
    private observerCameraStream: MediaStream | null = null;
    private observerVideoChunks: Blob[] = [];
    private observerEvents: ObserverCapturedEvent[] = [];
    private observerStartedAt = 0;
    private observerPaused = false;
    private observerPausedAt = 0;
    private observerPausedAccumulatedMs = 0;
    private observerCleanupFns: Array<() => void> = [];
    private observerStopping = false;
    private observerCaptureSource: "none" | "dom" | "webmcp" = "none";
    private observerWebMCPAdapter: WebMCPObserverAdapter | null = null;
    private observerToolbarEl: HTMLElement | null = null;
    private observerToolbarTimerEl: HTMLElement | null = null;
    private observerToolbarPauseBtnEl: HTMLButtonElement | null = null;
    private observerToolbarHelpEl: HTMLElement | null = null;
    private observerToolbarTimerInterval: number | null = null;
    private observerShortcutListener: ((evt: KeyboardEvent) => void) | null = null;
    private observerCameraPreviewEl: HTMLElement | null = null;
    private observerCameraPreviewVideoEl: HTMLVideoElement | null = null;
    private observerSetupToolbarEl: HTMLElement | null = null;
    private observerSetupCameraStream: MediaStream | null = null;
    private observerToolbarDragCleanup: (() => void) | null = null;
    private observerCameraPreviewDragCleanup: (() => void) | null = null;
    private observerToolbarPosition: { left: number; top: number } | null = null;
    private observerCameraPreviewPosition: { left: number; top: number } | null = null;
    private observerButtonExpandTimer: number | null = null;
    private observerButtonCollapseTimer: number | null = null;
    private observerButtonIsExpanded = false;

    private isSpanishLocale(): boolean {
        return String(this.context.locale || this.config.locale || "").toLowerCase().startsWith("es");
    }

    constructor(config: LumaClientConfig, userContext: LumaUserContext = {}) {
        this.debugMode = config.debug === true;
        console.log("LumaWay SDK: Initializing...", { config: { ...config, apiKey: config.apiKey ? "[REDACTED]" : undefined }, userContext, debug: this.debugMode });
        this.config = config;
        this.client = new LumaClient(config);
        this.audio = new AudioCueEngine(config.audio);
        this.strings = resolveSdkStrings(userContext.locale || config.locale);
        this.uiTheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
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
                enabled: false,
                initialMessages: messageHistory,
                locale: userContext.locale || config.locale,
                strings: this.strings,
                theme: this.uiTheme,
                uiSettings: {},
                onLocaleChange: (locale) => this.applyRuntimeLocale(locale),
                onThemeChange: (theme) => this.applyRuntimeTheme(theme),
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
            () => this.assistant ? this.assistant.isOpen : false,
            userContext.locale || config.locale
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
        this.automationOverlay = new AutomationOverlay({
            onPause: () => {
                this.automationPaused = true;
            },
            onResume: () => {
                this.automationPaused = false;
            },
            onStop: () => {
                this.automationStopped = true;
                this.hideAutomationCursor();
                this.hideAuthorizationTargetFocus();
                if (this.authorizeResolver) {
                    this.authorizeResolver(false);
                    this.authorizeResolver = null;
                }
                this.automationOverlay.hide();
                this.assistant.setAutomationChatLock(false);
                this.assistant.close();
                this.audio.play("cancel");
            },
            onAuthorize: () => {
                if (this.authorizeResolver) {
                    this.authorizeResolver(true);
                    this.authorizeResolver = null;
                }
                this.hideAuthorizationTargetFocus();
                this.automationOverlay.setNeedsAuthorization(false);
                this.audio.play("success");
            },
            locale: userContext.locale || config.locale,
        });

        this.init().catch(err => {
            console.error("LumaWay SDK: Initialization failed:", err);
        });
    }

    private async init() {
        console.log("LumaWay SDK: Fetching configuration...");
        this.projectConfig = await this.client.fetchProjectConfig();
        const projectLocale = this.projectConfig?.settings?.defaultLocale || this.projectConfig?.settings?.supportedLocales?.[0];
        if (!this.context.locale && projectLocale) this.context.locale = String(projectLocale);
        this.applyRuntimeLocale(this.context.locale || this.config.locale || "en");
        const assistantEnabled = Boolean(this.projectConfig?.settings?.assistantEnabled);
        const chatbotEnabled = Boolean(this.projectConfig?.settings?.chatbotEnabled);
        this.assistant.setEnabled(assistantEnabled && chatbotEnabled);
        this.assistant.setUiSettings(this.projectConfig?.settings?.chatbotUi || {});
        this.observerEnabled = Boolean(this.projectConfig?.settings?.observerMode?.enabled);
        if (this.observerEnabled) {
            this.mountObserverButton();
        }

        // Check WebMCP availability and configuration
        this.webMCPAvailable = this.checkWebMCPAvailable();
        this.webMCPConfig = this.projectConfig?.settings?.webMCP || null;
        await this.refreshWebMCPDiagnostics();

        if (this.webMCPAvailable && this.webMCPConfig?.enabled) {
            console.log("LumaWay SDK: WebMCP available and enabled", {
                permissionLevel: this.webMCPConfig.permissionLevel,
                allowedActions: this.webMCPConfig.allowedActions,
                diagnostics: this.webMCPDiagnostics,
            });
        } else {
            console.log("LumaWay SDK: WebMCP not available or disabled", {
                enabled: this.webMCPConfig?.enabled,
                diagnostics: this.webMCPDiagnostics,
            });
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

    private mountObserverButton() {
        if (typeof document === "undefined") return;

        const existing = document.getElementById("luma-observer-mode-btn");
        if (existing) existing.remove();

        const btn = document.createElement("button");
        btn.id = "luma-observer-mode-btn";
        btn.type = "button";
        btn.title = "Lumen Mode";

        const position = this.projectConfig?.settings?.chatbotUi?.position || "bottom-right";
        const triggerSize = Number(this.projectConfig?.settings?.chatbotUi?.triggerSize || 64);
        const baseBottom = 24 + triggerSize + 18;
        const observerButtonSize = 56;
        const alignedSideOffset = Math.max(12, 24 + Math.round((triggerSize - observerButtonSize) / 2));
        btn.style.position = "fixed";
        btn.style.bottom = `${baseBottom}px`;
        btn.style.zIndex = "2147483647";
        if (position === "bottom-left") {
            btn.style.left = `${alignedSideOffset}px`;
        } else {
            btn.style.right = `${alignedSideOffset}px`;
        }
        btn.style.height = `${observerButtonSize}px`;
        btn.style.width = `${observerButtonSize}px`;
        btn.style.padding = "0";
        btn.style.borderRadius = "999px";
        btn.style.border = "2px solid rgba(147,197,253,0.85)";
        btn.style.background = "#1f66d3";
        btn.style.color = "#ffffff";
        btn.style.fontSize = "17px";
        btn.style.fontWeight = "700";
        btn.style.display = "inline-flex";
        btn.style.alignItems = "center";
        btn.style.justifyContent = "center";
        btn.style.gap = "10px";
        btn.style.overflow = "hidden";
        btn.style.whiteSpace = "nowrap";
        btn.style.cursor = "pointer";
        btn.style.boxShadow = "0 12px 28px rgba(10,26,56,0.34)";
        btn.style.transition = "width .24s ease, padding .24s ease, background .18s ease, color .18s ease, border-color .18s ease";

        btn.onclick = async () => {
            if (this.observerStopping) return;
            this.animateObserverButtonReveal();
            if (!this.observerSessionId) {
                const options = await this.openObserverStartDialog();
                if (!options) return;
                await this.startObserverRecording(options);
            } else {
                await this.stopObserverRecording();
            }
        };

        document.body.appendChild(btn);
        this.observerButton = btn;
        this.setObserverButtonState("idle");
    }

    private setObserverButtonContent(label: string, icon: ObserverIconName, iconColor: string) {
        if (!this.observerButton) return;
        this.observerButton.textContent = "";
        const iconWrap = document.createElement("span");
        iconWrap.style.cssText = "width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;";
        iconWrap.appendChild(this.createObserverIcon(icon, 24, iconColor));
        this.observerButton.appendChild(iconWrap);
        const text = document.createElement("span");
        text.textContent = label;
        text.style.cssText = "line-height:1;letter-spacing:-0.01em;white-space:nowrap;max-width:0;opacity:0;overflow:hidden;transform:translateX(6px);transition:max-width .24s ease,opacity .2s ease,transform .24s ease;";
        text.dataset.role = "observer-trigger-label";
        this.observerButton.appendChild(text);
        this.applyObserverButtonExpandedState(this.observerButtonIsExpanded);
    }

    private applyObserverButtonExpandedState(expanded: boolean) {
        if (!this.observerButton) return;
        const label = this.observerButton.querySelector('[data-role="observer-trigger-label"]') as HTMLElement | null;
        const iconOnlySize = "56px";
        const expandedWidth = "236px";
        if (expanded) {
            this.observerButton.style.width = expandedWidth;
            this.observerButton.style.padding = "0 18px";
            this.observerButton.style.justifyContent = "flex-start";
            this.observerButton.style.gap = "10px";
            if (label) {
                label.style.maxWidth = "170px";
                label.style.opacity = "1";
                label.style.transform = "translateX(0)";
            }
            return;
        }
        this.observerButton.style.width = iconOnlySize;
        this.observerButton.style.padding = "0";
        this.observerButton.style.justifyContent = "center";
        this.observerButton.style.gap = "0";
        if (label) {
            const opensFromLeft = Boolean(this.observerButton.style.left);
            label.style.maxWidth = "0";
            label.style.opacity = "0";
            label.style.transform = opensFromLeft ? "translateX(-6px)" : "translateX(6px)";
        }
    }

    private animateObserverButtonReveal() {
        if (!this.observerButton) return;
        if (this.observerButtonExpandTimer !== null) {
            window.clearTimeout(this.observerButtonExpandTimer);
            this.observerButtonExpandTimer = null;
        }
        if (this.observerButtonCollapseTimer !== null) {
            window.clearTimeout(this.observerButtonCollapseTimer);
            this.observerButtonCollapseTimer = null;
        }
        this.observerButtonIsExpanded = true;
        this.applyObserverButtonExpandedState(true);
        this.observerButtonExpandTimer = window.setTimeout(() => {
            this.observerButtonIsExpanded = false;
            this.applyObserverButtonExpandedState(false);
            this.observerButtonExpandTimer = null;
        }, 1200);
    }

    private async openObserverStartDialog(): Promise<ObserverStartOptions | null> {
        if (typeof document === "undefined") return null;

        const defaultSystemAudio = Boolean(this.projectConfig?.settings?.observerMode?.captureAudio);
        let options: ObserverStartOptions = {
            captureSystemAudio: defaultSystemAudio,
            captureMicrophone: true,
            captureCamera: false,
        };

        return await new Promise<ObserverStartOptions | null>((resolve) => {
            const existing = document.getElementById("luma-observer-start-panel");
            if (existing) existing.remove();

            const panel = document.createElement("div");
            panel.id = "luma-observer-start-panel";
            const anchor = this.observerButton?.getBoundingClientRect();
            const prefersLeft = Boolean(this.assistant && this.assistant.isOpen);
            const fallbackRight = 24;
            const panelWidth = Math.min(320, window.innerWidth - 24);
            const left = anchor
                ? Math.max(
                    12,
                    Math.min(
                        window.innerWidth - panelWidth - 12,
                        prefersLeft ? anchor.left - panelWidth - 14 : anchor.right - panelWidth
                    )
                )
                : Math.max(12, window.innerWidth - panelWidth - fallbackRight);
            const top = anchor
                ? Math.max(12, anchor.top - 420)
                : Math.max(12, window.innerHeight - 500);

            panel.style.cssText = `
                position: fixed;
                z-index: 2147483647;
                width: ${panelWidth}px;
                max-width: calc(100vw - 24px);
                left: ${left}px;
                top: ${top}px;
                background: #f3f4f6;
                color: #1f2937;
                border-radius: 30px;
                border: 1px solid rgba(15,23,42,0.08);
                box-shadow: 0 20px 56px rgba(15,23,42,0.34);
                padding: 18px 16px 14px;
                font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
                overflow: visible;
            `;

            const header = document.createElement("div");
            header.style.cssText = "display:grid;grid-template-columns:1fr auto;align-items:center;column-gap:12px;margin-bottom:12px;padding-right:0;";

            const brand = document.createElement("div");
            brand.style.cssText = "display:flex;align-items:center;gap:12px;min-width:0;";
            const badge = document.createElement("div");
            badge.style.cssText = `
                width: 44px; height: 44px; border-radius: 12px;
                background: #226cda; color: #ffffff; display:flex;align-items:center;justify-content:center;
            `;
            badge.appendChild(this.createObserverIcon("spark", 18, "#ffffff"));
            const name = document.createElement("div");
            name.textContent = "Lumen";
            name.style.cssText = "font-size: 22px; line-height: 1; font-weight: 700; letter-spacing: -0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
            brand.appendChild(badge);
            brand.appendChild(name);
            header.appendChild(brand);

            const icons = document.createElement("div");
            icons.style.cssText = "display:flex;align-items:center;justify-self:end;gap:8px;color:#1f2937;margin-right:0;";
            const iconHelp = document.createElement("button");
            iconHelp.type = "button";
            iconHelp.style.cssText = "width:56px;height:36px;border-radius:999px;border:2px solid rgba(31,41,55,0.65);background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .2s ease,border-color .2s ease;";
            const helpIcon = this.createObserverIcon("help", 15, "#1f2937");
            helpIcon.style.transition = "transform .22s ease";
            iconHelp.appendChild(helpIcon);
            icons.appendChild(iconHelp);
            const homeBtn = document.createElement("button");
            homeBtn.type = "button";
            homeBtn.ariaLabel = "Go to CMS";
            homeBtn.style.cssText = "width:34px;height:34px;border:0;background:transparent;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#1f2937;cursor:pointer;";
            {
                const ns = "http://www.w3.org/2000/svg";
                const homeSvg = document.createElementNS(ns, "svg");
                homeSvg.setAttribute("viewBox", "0 0 24 24");
                homeSvg.setAttribute("aria-hidden", "true");
                homeSvg.setAttribute(
                    "style",
                    "display:block !important;width:20px !important;height:20px !important;min-width:20px;min-height:20px;opacity:1;visibility:visible;overflow:visible;fill:currentColor;color:#1f2937;pointer-events:none;"
                );
                const homePath = document.createElementNS(ns, "path");
                homePath.setAttribute("fill-rule", "evenodd");
                homePath.setAttribute("clip-rule", "evenodd");
                homePath.setAttribute(
                    "style",
                    "fill:currentColor !important;opacity:1;visibility:visible;"
                );
                homePath.setAttribute(
                    "d",
                    "M6 22.75A4.75 4.75 0 0 1 1.25 18v-4.343c0-1.26.5-2.468 1.391-3.359l6-6a4.75 4.75 0 0 1 6.718 0l6 6a4.75 4.75 0 0 1 1.391 3.359V18A4.75 4.75 0 0 1 18 22.75zM9.702 5.359a3.25 3.25 0 0 1 4.596 0l6 6c.61.61.952 1.436.952 2.298V18A3.25 3.25 0 0 1 18 21.25h-3.25V16a2.75 2.75 0 1 0-5.5 0v5.25H6A3.25 3.25 0 0 1 2.75 18v-4.343c0-.862.342-1.689.952-2.298zM10.75 21.25h2.5V16a1.25 1.25 0 1 0-2.5 0z"
                );
                homeSvg.appendChild(homePath);
                homeBtn.appendChild(homeSvg);
            }
            homeBtn.onclick = () => {
                const cmsUrl = this.resolveCmsUrl();
                if (!cmsUrl) return;
                window.open(cmsUrl, "_blank", "noopener,noreferrer");
            };
            icons.appendChild(homeBtn);
            header.appendChild(icons);

            panel.appendChild(header);


            const helpCard = document.createElement("div");
            helpCard.style.cssText = `
                position: absolute;
                z-index: 20;
                top: 66px;
                left: -20px;
                width: min(344px, calc(100vw - 40px));
                background: #f8fafc;
                border: 1px solid #d1d5db;
                border-radius: 28px;
                box-shadow: 0 22px 52px rgba(15,23,42,0.24);
                padding: 18px 18px 16px;
                opacity: 0;
                transform: translateY(-8px) scale(0.985);
                transform-origin: top right;
                transition: opacity .2s ease, transform .2s ease;
                pointer-events: none;
            `;
            const helpTitle = document.createElement("div");
            helpTitle.textContent = "Need help getting started?";
            helpTitle.style.cssText = "font-size:18px;font-weight:750;letter-spacing:-0.012em;color:#1f2937;margin-bottom:12px;line-height:1.2;";
            helpCard.appendChild(helpTitle);

            const helpRows = document.createElement("div");
            helpRows.style.cssText = "display:flex;flex-direction:column;gap:6px;";
            const createHelpRow = (icon: ObserverIconName, label: string) => {
                const row = document.createElement("div");
                row.style.cssText = "height:56px;border-radius:14px;display:grid;grid-template-columns:44px 1fr;align-items:center;column-gap:12px;padding:0 8px;color:#1f2937;font-size:16px;font-weight:650;letter-spacing:-0.012em;line-height:1.05;";
                const badge = document.createElement("span");
                badge.style.cssText = "width:44px;height:44px;border-radius:14px;background:#dbeafe;display:flex;align-items:center;justify-content:center;";
                badge.appendChild(this.createObserverIcon(icon, 21, "#2563eb"));
                const text = document.createElement("span");
                text.textContent = label;
                text.style.cssText = "font-size:16px;font-weight:650;letter-spacing:-0.012em;line-height:1.05;";
                row.appendChild(badge);
                row.appendChild(text);
                helpRows.appendChild(row);
            };
            createHelpRow("play", "Start a 1 minute tutorial");
            createHelpRow("camera", "Discover use cases");
            createHelpRow("help", "Help & Support");
            helpCard.appendChild(helpRows);
            panel.appendChild(helpCard);

            let helpOpen = false;
            const setHelpOpen = (open: boolean) => {
                helpOpen = open;
                helpCard.style.opacity = open ? "1" : "0";
                helpCard.style.transform = open ? "translateY(0) scale(1)" : "translateY(-8px) scale(0.985)";
                helpCard.style.pointerEvents = open ? "auto" : "none";
                iconHelp.style.background = open ? "rgba(31,41,55,0.08)" : "transparent";
                iconHelp.style.borderColor = open ? "rgba(31,41,55,0.95)" : "rgba(31,41,55,0.75)";
                helpIcon.style.transform = open ? "rotate(18deg)" : "rotate(0deg)";
                iconHelp.setAttribute("aria-expanded", open ? "true" : "false");
            };
            iconHelp.onclick = (evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                setHelpOpen(!helpOpen);
            };

            const syncSetupPreview = async () => {
                this.mountObserverSetupToolbar();
                if (!options.captureCamera) {
                    for (const track of this.observerSetupCameraStream?.getTracks() || []) track.stop();
                    this.observerSetupCameraStream = null;
                    this.unmountObserverCameraPreview();
                    return;
                }
                if (!navigator.mediaDevices?.getUserMedia) {
                    this.unmountObserverCameraPreview();
                    return;
                }
                if (!this.observerSetupCameraStream) {
                    try {
                        this.observerSetupCameraStream = await navigator.mediaDevices.getUserMedia({
                            video: true,
                            audio: false,
                        });
                    } catch {
                        options.captureCamera = false;
                        this.unmountObserverCameraPreview();
                        return;
                    }
                }
                this.mountObserverCameraPreview(this.observerSetupCameraStream);
            };

            const sub = document.createElement("div");
            sub.textContent = "Configure camera and microphone permissions.";
            sub.style.cssText = "font-size:12px;color:#4b5563;margin-bottom:12px;line-height:1.35;";
            panel.appendChild(sub);

            const stack = document.createElement("div");
            stack.style.cssText = "display:flex;flex-direction:column;gap:10px;";

            const createRow = (
                key: keyof ObserverStartOptions,
                icon: ObserverIconName,
                label: string,
                checked: boolean,
                opts?: { disabled?: boolean; activeOnBlue?: boolean }
            ) => {
                const disabled = Boolean(opts?.disabled);
                const row = document.createElement("button");
                row.type = "button";
                row.style.cssText = `
                    width: 100%;
                    height: 56px;
                    border-radius: 18px;
                    border: 0;
                    background: #e5e7eb;
                    color: #2d313a;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 12px 0 14px;
                    cursor: ${disabled ? "default" : "pointer"};
                    transition: transform .14s ease, background .14s ease;
                `;

                const left = document.createElement("div");
                left.style.cssText = "display:flex;align-items:center;gap:10px;min-width:0;";
                const iconWrap = document.createElement("span");
                iconWrap.style.cssText = "width:32px;height:32px;display:flex;align-items:center;justify-content:center;opacity:.95;";
                iconWrap.appendChild(this.createObserverIcon(icon, 20, "#2d313a"));
                const textEl = document.createElement("span");
                textEl.textContent = label;
                textEl.style.cssText = "font-size:16px;line-height:1.06;font-weight:650;letter-spacing:-0.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
                left.appendChild(iconWrap);
                left.appendChild(textEl);

                const pill = document.createElement("div");
                pill.style.cssText = `
                    min-width: 74px;
                    height: 32px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 13px;
                    line-height: 1;
                    font-weight: 700;
                    padding: 0 14px;
                `;

                const setVisual = (isOn: boolean) => {
                    if (disabled) {
                        pill.style.background = "#d1d5db";
                        pill.style.color = "#374151";
                        pill.textContent = "";
                        return;
                    }
                    if (isOn) {
                        pill.style.background = opts?.activeOnBlue ? "#f3f4f6" : "#15803d";
                        pill.style.color = opts?.activeOnBlue ? "#2563eb" : "#ecfdf5";
                        pill.textContent = "On";
                        row.style.background = opts?.activeOnBlue ? "#2d6fd0" : "#e5e7eb";
                        row.style.color = opts?.activeOnBlue ? "#ffffff" : "#2d313a";
                        row.style.boxShadow = opts?.activeOnBlue ? "inset 0 -3px 0 rgba(191,219,254,0.9)" : "none";
                        (iconWrap.firstElementChild as SVGElement | null)?.setAttribute("stroke", opts?.activeOnBlue ? "#ffffff" : "#2d313a");
                    } else {
                        pill.style.background = "#cfd4dc";
                        pill.style.color = "#4b5563";
                        pill.textContent = "Off";
                        row.style.background = "#e5e7eb";
                        row.style.color = "#2d313a";
                        row.style.boxShadow = "none";
                        (iconWrap.firstElementChild as SVGElement | null)?.setAttribute("stroke", "#2d313a");
                    }
                };
                setVisual(checked);

                row.onclick = () => {
                    if (disabled) return;
                    const next = !options[key];
                    options = { ...options, [key]: next };
                    setVisual(next);
                    if (key === "captureCamera") {
                        void syncSetupPreview();
                    }
                };

                row.appendChild(left);
                row.appendChild(pill);
                stack.appendChild(row);
            };

            createRow("captureSystemAudio", "monitor", "Full Screen", true, { disabled: true });
            createRow("captureCamera", "camera", "Camera", options.captureCamera);
            createRow("captureMicrophone", "microphone", "Microphone", options.captureMicrophone, { activeOnBlue: true });

            panel.appendChild(stack);

            const actions = document.createElement("div");
            actions.style.cssText = "display:flex;gap:10px;margin-top:12px;";

            const cancelBtn = document.createElement("button");
            cancelBtn.type = "button";
            cancelBtn.textContent = "Cancel";
            cancelBtn.style.cssText = `
                flex: 0 0 96px;
                height: 48px;
                border-radius: 15px;
                border: 0;
                background: #d1d5db;
                color: #111827;
                font-size: 15px;
                font-weight: 700;
                letter-spacing: -0.01em;
                cursor: pointer;
            `;
            cancelBtn.onclick = () => {
                cleanup();
                resolve(null);
            };
            actions.appendChild(cancelBtn);

            const startBtn = document.createElement("button");
            startBtn.type = "button";
            startBtn.textContent = "Start recording";
            startBtn.style.cssText = `
                flex: 1;
                height: 48px;
                border-radius: 15px;
                border: 0;
                background: #ff5d3d;
                color: #ffffff;
                font-size: 17px;
                font-weight: 750;
                letter-spacing: -0.02em;
                cursor: pointer;
            `;
            startBtn.onclick = () => {
                cleanup();
                resolve(options);
            };
            actions.appendChild(startBtn);

            panel.appendChild(actions);
            document.body.appendChild(panel);
            this.fitObserverPanelToViewport(panel);
            void syncSetupPreview();
            const onResize = () => {
                this.fitObserverPanelToViewport(panel);
            };
            window.addEventListener("resize", onResize);

            const onDocPointerDown = (evt: PointerEvent) => {
                const target = evt.target as Node | null;
                if (!target) return;
                if (panel.contains(target)) return;
                if (this.observerButton && this.observerButton.contains(target as Node)) return;
                cleanup();
                resolve(null);
            };

            const onKeyDown = (evt: KeyboardEvent) => {
                if (evt.key === "Escape") {
                    cleanup();
                    resolve(null);
                }
            };

            const cleanup = () => {
                document.removeEventListener("pointerdown", onDocPointerDown, true);
                window.removeEventListener("keydown", onKeyDown, true);
                window.removeEventListener("resize", onResize);
                for (const track of this.observerSetupCameraStream?.getTracks() || []) track.stop();
                this.observerSetupCameraStream = null;
                this.unmountObserverSetupToolbar();
                this.unmountObserverCameraPreview();
                panel.remove();
            };

            document.addEventListener("pointerdown", onDocPointerDown, true);
            window.addEventListener("keydown", onKeyDown, true);
        });
    }

    private setObserverButtonState(state: "idle" | "recording" | "processing" | "error") {
        if (!this.observerButton) return;
        if (state === "idle") {
            this.setObserverButtonContent("Record a video", "camera", "#ffffff");
            this.observerButton.style.background = "#1f66d3";
            this.observerButton.style.color = "#ffffff";
            this.observerButton.style.borderColor = "rgba(255,255,255,0.26)";
            return;
        }
        if (state === "recording") {
            this.setObserverButtonContent("Stop recording", "stop", "#ffffff");
            this.observerButton.style.background = "#dc2626";
            this.observerButton.style.color = "#ffffff";
            this.observerButton.style.borderColor = "rgba(255,255,255,0.24)";
            return;
        }
        if (state === "processing") {
            this.setObserverButtonContent("Processing...", "spark", "#ffffff");
            this.observerButton.style.background = "#2563eb";
            this.observerButton.style.color = "#ffffff";
            this.observerButton.style.borderColor = "rgba(255,255,255,0.24)";
            return;
        }
        this.setObserverButtonContent("Retry recording", "camera", "#ffffff");
        this.observerButton.style.background = "#b91c1c";
        this.observerButton.style.color = "#ffffff";
        this.observerButton.style.borderColor = "rgba(255,255,255,0.24)";
    }

    private getObserverEventSelector(target: HTMLElement): string {
        if (target.id) return `#${target.id}`;
        const testId = target.getAttribute("data-testid");
        if (testId) return `[data-testid="${testId}"]`;
        const name = target.getAttribute("name");
        if (name) return `[name="${name}"]`;
        const tag = target.tagName.toLowerCase();
        const classes = Array.from(target.classList).slice(0, 2).join(".");
        return classes ? `${tag}.${classes}` : tag;
    }

    private pushObserverEvent(event: ObserverCapturedEvent) {
        if (this.observerPaused) return;
        this.observerEvents.push(event);
        if (this.observerEvents.length > 5000) {
            this.observerEvents.shift();
        }
    }

    private isObserverInternalNode(target: EventTarget | null): boolean {
        const node = target as HTMLElement | null;
        if (!node || !node.closest) return false;
        return Boolean(node.closest("#luma-observer-mode-btn") || node.closest("#luma-assistant-host"));
    }

    private isObserverInternalSelector(selector?: string): boolean {
        const value = String(selector || "").toLowerCase();
        return value.includes("#luma-observer-mode-btn") || value.includes("#luma-assistant-host");
    }

    private attachObserverListeners() {
        const onClick = (evt: Event) => {
            if (this.isObserverInternalNode(evt.target)) return;
            const target = evt.target as HTMLElement | null;
            if (!target) return;
            this.pushObserverEvent({
                type: "click",
                timestampMs: Date.now() - this.observerStartedAt,
                url: window.location.pathname + window.location.search,
                targetSelector: this.getObserverEventSelector(target),
                label: (target.innerText || target.getAttribute("aria-label") || "").slice(0, 120),
            });
        };

        const onChange = (evt: Event) => {
            if (this.isObserverInternalNode(evt.target)) return;
            const target = evt.target as HTMLInputElement | HTMLTextAreaElement | null;
            if (!target) return;
            const lowerType = String((target as HTMLInputElement).type || "").toLowerCase();
            const isSensitive = lowerType === "password" || lowerType === "email" || lowerType === "tel";
            this.pushObserverEvent({
                type: "change",
                timestampMs: Date.now() - this.observerStartedAt,
                url: window.location.pathname + window.location.search,
                targetSelector: this.getObserverEventSelector(target),
                label: target.name || target.id || target.placeholder || "",
                payload: isSensitive ? { redacted: true } : { valueLength: String(target.value || "").length },
            });
        };

        const onScroll = () => {
            this.pushObserverEvent({
                type: "scroll",
                timestampMs: Date.now() - this.observerStartedAt,
                url: window.location.pathname + window.location.search,
                payload: { x: window.scrollX, y: window.scrollY },
            });
        };

        const onNav = () => {
            this.pushObserverEvent({
                type: "navigation",
                timestampMs: Date.now() - this.observerStartedAt,
                url: window.location.pathname + window.location.search,
            });
        };

        document.addEventListener("click", onClick, true);
        document.addEventListener("change", onChange, true);
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("popstate", onNav);
        window.addEventListener("hashchange", onNav);

        this.observerCleanupFns.push(() => document.removeEventListener("click", onClick, true));
        this.observerCleanupFns.push(() => document.removeEventListener("change", onChange, true));
        this.observerCleanupFns.push(() => window.removeEventListener("scroll", onScroll));
        this.observerCleanupFns.push(() => window.removeEventListener("popstate", onNav));
        this.observerCleanupFns.push(() => window.removeEventListener("hashchange", onNav));
        this.observerCaptureSource = "dom";
    }

    private async attachWebMCPObserverIfAvailable(): Promise<boolean> {
        const webMCPEnabled = this.webMCPConfig?.enabled !== false;
        if (!webMCPEnabled || !this.webMCPAvailable) return false;

        const adapter = new WebMCPObserverAdapter({
            onEvent: (event) => this.pushObserverEvent(event),
            isInternalSelector: (selector) => this.isObserverInternalSelector(selector),
            getStartedAt: () => this.observerStartedAt,
        });

        const started = await adapter.start();
        if (!started.active) {
            await adapter.stop();
            return false;
        }

        this.observerWebMCPAdapter = adapter;
        this.observerCaptureSource = "webmcp";
        return true;
    }

    private async detachWebMCPObserver() {
        if (!this.observerWebMCPAdapter) return;
        try {
            await this.observerWebMCPAdapter.stop();
        } catch {
            // Soft-fail: this should never block recording finalization.
        } finally {
            this.observerWebMCPAdapter = null;
        }
    }

    private formatObserverElapsed(ms: number): string {
        const safe = Math.max(0, Math.floor(ms / 1000));
        const mins = Math.floor(safe / 60);
        const secs = safe % 60;
        return `${mins}:${String(secs).padStart(2, "0")}`;
    }

    private getObserverElapsedMs() {
        if (!this.observerStartedAt) return 0;
        const now = Date.now();
        const pausedNow = this.observerPaused ? now - this.observerPausedAt : 0;
        return Math.max(0, now - this.observerStartedAt - this.observerPausedAccumulatedMs - pausedNow);
    }

    private updateObserverToolbarUi() {
        if (this.observerToolbarTimerEl) {
            this.observerToolbarTimerEl.textContent = this.formatObserverElapsed(this.getObserverElapsedMs());
        }
        if (this.observerToolbarPauseBtnEl) {
            this.setObserverIconOnButton(
                this.observerToolbarPauseBtnEl,
                this.observerPaused ? "play" : "pause",
                24,
                "#6b7280"
            );
            this.observerToolbarPauseBtnEl.title = this.observerPaused
                ? "Reanudar (Space/K)"
                : "Pausar (Space/K)";
        }
    }

    private createObserverIcon(name: ObserverIconName, size = 20, color = "currentColor"): SVGSVGElement {
        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");
        svg.setAttribute("width", String(size));
        svg.setAttribute("height", String(size));
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", color);
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");

        const path = (d: string) => {
            const p = document.createElementNS(ns, "path");
            p.setAttribute("d", d);
            svg.appendChild(p);
        };
        const circle = (cx: number, cy: number, r: number) => {
            const c = document.createElementNS(ns, "circle");
            c.setAttribute("cx", String(cx));
            c.setAttribute("cy", String(cy));
            c.setAttribute("r", String(r));
            svg.appendChild(c);
        };
        const rect = (x: number, y: number, width: number, height: number, rx = 0) => {
            const r = document.createElementNS(ns, "rect");
            r.setAttribute("x", String(x));
            r.setAttribute("y", String(y));
            r.setAttribute("width", String(width));
            r.setAttribute("height", String(height));
            if (rx > 0) r.setAttribute("rx", String(rx));
            svg.appendChild(r);
        };
        const line = (x1: number, y1: number, x2: number, y2: number) => {
            const l = document.createElementNS(ns, "line");
            l.setAttribute("x1", String(x1));
            l.setAttribute("y1", String(y1));
            l.setAttribute("x2", String(x2));
            l.setAttribute("y2", String(y2));
            svg.appendChild(l);
        };

        switch (name) {
            case "spark":
                circle(12, 12, 2.2);
                path("M12 3v3");
                path("M12 18v3");
                path("M3 12h3");
                path("M18 12h3");
                path("M5.6 5.6l2.2 2.2");
                path("M16.2 16.2l2.2 2.2");
                path("M18.4 5.6l-2.2 2.2");
                path("M7.8 16.2l-2.2 2.2");
                break;
            case "monitor":
                rect(3, 4, 18, 13, 2);
                path("M8 20h8");
                path("M12 17v3");
                break;
            case "camera":
                rect(3, 7, 13, 10, 3);
                path("M16 10.2l5-2.7v9l-5-2.7z");
                circle(9.5, 12, 2.1);
                break;
            case "microphone":
                rect(9, 3, 6, 11, 3);
                path("M5 11a7 7 0 0 0 14 0");
                path("M12 18v3");
                path("M8 21h8");
                break;
            case "help":
                circle(12, 12, 9);
                path("M9.5 9a2.5 2.5 0 1 1 3.9 2.1c-.9.6-1.4 1.1-1.4 2.2");
                circle(12, 17.2, 0.6);
                break;
            case "home":
                svg.setAttribute("fill", "none");
                svg.setAttribute("stroke", "none");
                {
                    const p = document.createElementNS(ns, "path");
                    // Source adapted from provided home icon; render with current color for theme consistency.
                    p.setAttribute(
                        "d",
                        "M6 22.75A4.75 4.75 0 0 1 1.25 18v-4.343c0-1.26.5-2.468 1.391-3.359l6-6a4.75 4.75 0 0 1 6.718 0l6 6a4.75 4.75 0 0 1 1.391 3.359V18A4.75 4.75 0 0 1 18 22.75zM9.702 5.359a3.25 3.25 0 0 1 4.596 0l6 6c.61.61.952 1.436.952 2.298V18A3.25 3.25 0 0 1 18 21.25h-3.25V16a2.75 2.75 0 1 0-5.5 0v5.25H6A3.25 3.25 0 0 1 2.75 18v-4.343c0-.862.342-1.689.952-2.298zM10.75 21.25h2.5V16a1.25 1.25 0 1 0-2.5 0z"
                    );
                    p.setAttribute("fill", color);
                    p.setAttribute("fill-rule", "evenodd");
                    p.setAttribute("clip-rule", "evenodd");
                    svg.appendChild(p);
                }
                break;
            case "stop":
                svg.setAttribute("fill", "none");
                svg.setAttribute("stroke", "none");
                {
                    const p = document.createElementNS(ns, "path");
                    // Source adapted from provided stop icon; rendered with currentColor for theme consistency.
                    p.setAttribute("d", "M30 5v22a3.003 3.003 0 0 1-3 3H5a3.003 3.003 0 0 1-3-3V5a3.003 3.003 0 0 1 3-3h22a3.003 3.003 0 0 1 3 3z");
                    p.setAttribute("fill", color);
                    p.setAttribute("transform", "translate(0,0) scale(0.75)");
                    svg.appendChild(p);
                }
                break;
            case "pause":
                svg.setAttribute("fill", "none");
                svg.setAttribute("stroke", "none");
                {
                    const leftBar = document.createElementNS(ns, "rect");
                    leftBar.setAttribute("x", "3.5");
                    leftBar.setAttribute("y", "2.5");
                    leftBar.setAttribute("width", "7");
                    leftBar.setAttribute("height", "19");
                    leftBar.setAttribute("rx", "2.5");
                    leftBar.setAttribute("fill", color);
                    svg.appendChild(leftBar);

                    const rightBar = document.createElementNS(ns, "rect");
                    rightBar.setAttribute("x", "13.5");
                    rightBar.setAttribute("y", "2.5");
                    rightBar.setAttribute("width", "7");
                    rightBar.setAttribute("height", "19");
                    rightBar.setAttribute("rx", "2.5");
                    rightBar.setAttribute("fill", color);
                    svg.appendChild(rightBar);
                }
                break;
            case "play":
                path("M8 6l10 6-10 6z");
                break;
            case "restart":
                path("M4.4 6.1A8 8 0 1 1 3.2 13");
                path("M3.2 6.2h4.2v4.2");
                break;
            case "keyboard":
                rect(3, 6, 18, 12, 2.5);
                rect(6, 9, 2.2, 2.2, 0.8);
                rect(9.4, 9, 2.2, 2.2, 0.8);
                rect(12.8, 9, 2.2, 2.2, 0.8);
                rect(16.2, 9, 2.2, 2.2, 0.8);
                rect(6, 13, 12.4, 2.2, 0.9);
                break;
            case "trash":
                path("M4 7h16");
                path("M9 7V4h6v3");
                rect(6.5, 7, 11, 13, 1.8);
                line(10, 11, 10, 17);
                line(14, 11, 14, 17);
                break;
        }
        return svg;
    }

    private getObserverToolbarDefaultPosition() {
        const estimatedHeight = 430;
        return { left: 20, top: Math.max(18, Math.round((window.innerHeight - estimatedHeight) / 2)) };
    }

    private fitObserverPanelToViewport(panel: HTMLElement) {
        const margin = 12;
        const rect = panel.getBoundingClientRect();
        const left = Math.min(Math.max(margin, rect.left), Math.max(margin, window.innerWidth - rect.width - margin));
        const top = Math.min(Math.max(margin, rect.top), Math.max(margin, window.innerHeight - rect.height - margin));
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
    }

    private resolveCmsUrl(): string | null {
        const candidates = [
            this.projectConfig?.settings?.cmsUrl,
            this.projectConfig?.settings?.dashboardUrl,
            this.projectConfig?.cmsUrl,
            (this.config as any)?.cmsUrl,
        ].filter(Boolean) as string[];

        if (candidates.length > 0) return candidates[0] ?? null;

        try {
            const api = new URL(this.config.apiUrl);
            if (api.hostname === "localhost" || api.hostname === "127.0.0.1") {
                return `${api.protocol}//${api.hostname}:3000`;
            }
        } catch {
            // ignore
        }
        return null;
    }

    private positionObserverCameraNearToolbar(node: HTMLElement) {
        const margin = 10;
        const rect = node.getBoundingClientRect();
        const toolbar = this.observerToolbarEl || this.observerSetupToolbarEl;
        let left = window.innerWidth - rect.width - margin;
        let top = window.innerHeight - rect.height - margin;

        if (toolbar) {
            const toolbarRect = toolbar.getBoundingClientRect();
            left = toolbarRect.left + (toolbarRect.width / 2) - (rect.width / 2);
            // Default to placing the camera preview above the Lumen bubble/toolbar.
            top = toolbarRect.top - rect.height - 14;
            if (top < margin) {
                top = toolbarRect.bottom + 14;
            }
        }

        const clamped = this.clampObserverFloatingPosition(left, top, rect.width, rect.height);
        node.style.left = `${clamped.left}px`;
        node.style.top = `${clamped.top}px`;
        node.style.right = "auto";
        node.style.bottom = "auto";
    }

    private setObserverIconOnButton(button: HTMLButtonElement, name: ObserverIconName, size = 18, color = "#f8fafc") {
        button.textContent = "";
        button.appendChild(this.createObserverIcon(name, size, color));
    }

    private clampObserverFloatingPosition(left: number, top: number, width: number, height: number) {
        const safeLeft = Math.min(Math.max(0, left), Math.max(0, window.innerWidth - width));
        const safeTop = Math.min(Math.max(0, top), Math.max(0, window.innerHeight - height));
        return { left: safeLeft, top: safeTop };
    }

    private makeObserverFloatingDraggable(
        element: HTMLElement,
        onMove: (position: { left: number; top: number }) => void,
        shouldIgnoreTarget?: (target: EventTarget | null) => boolean
    ): () => void {
        const onPointerDown = (evt: PointerEvent) => {
            if (evt.button !== 0) return;
            if (shouldIgnoreTarget?.(evt.target)) return;

            const rect = element.getBoundingClientRect();
            const offsetX = evt.clientX - rect.left;
            const offsetY = evt.clientY - rect.top;
            let rafId: number | null = null;
            let pendingLeft = rect.left;
            let pendingTop = rect.top;

            const applyPosition = () => {
                rafId = null;
                const clamped = this.clampObserverFloatingPosition(
                    pendingLeft,
                    pendingTop,
                    rect.width,
                    rect.height
                );
                element.style.left = `${clamped.left}px`;
                element.style.top = `${clamped.top}px`;
                element.style.right = "auto";
                element.style.bottom = "auto";
                onMove(clamped);
            };

            const onPointerMove = (moveEvt: PointerEvent) => {
                pendingLeft = moveEvt.clientX - offsetX;
                pendingTop = moveEvt.clientY - offsetY;
                if (rafId === null) {
                    rafId = window.requestAnimationFrame(applyPosition);
                }
            };

            const onPointerUp = () => {
                if (rafId !== null) {
                    window.cancelAnimationFrame(rafId);
                    applyPosition();
                }
                window.removeEventListener("pointermove", onPointerMove, true);
                window.removeEventListener("pointerup", onPointerUp, true);
            };

            window.addEventListener("pointermove", onPointerMove, true);
            window.addEventListener("pointerup", onPointerUp, true);
        };

        element.addEventListener("pointerdown", onPointerDown, true);
        return () => {
            element.removeEventListener("pointerdown", onPointerDown, true);
        };
    }

    private mountObserverToolbar() {
        if (typeof document === "undefined") return;
        this.unmountObserverToolbar();

        const existing = document.getElementById("luma-observer-toolbar");
        if (existing) existing.remove();

        const wrap = document.createElement("div");
        const defaultPos = this.getObserverToolbarDefaultPosition();
        wrap.id = "luma-observer-toolbar";
        wrap.style.cssText = `
            position: fixed;
            top: ${defaultPos.top}px;
            left: ${defaultPos.left}px;
            width: 86px;
            border-radius: 42px;
            background: linear-gradient(180deg,#1b2231 0%, #101827 100%);
            border: 1px solid rgba(148,163,184,0.32);
            box-shadow: 0 22px 44px rgba(2,6,23,0.48);
            z-index: 2147483647;
            padding: 10px 6px 10px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            color: #e2e8f0;
            user-select: none;
            cursor: grab;
        `;

        const makeBtn = (
            icon: ObserverIconName,
            title: string,
            onClick: () => void,
            size: "control" | "top" | "camera" = "control"
        ) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.title = title;
            btn.style.cssText = `
                width: ${size === "top" ? 62 : size === "camera" ? 48 : 66}px;
                height: ${size === "top" ? 62 : size === "camera" ? 48 : 66}px;
                border-radius: ${size === "top" ? 22 : size === "camera" ? 15 : 22}px;
                border: ${size === "top" ? "1.5px solid rgba(251,113,133,0.35)" : "0"};
                background: ${size === "top" ? "linear-gradient(180deg,#0a0f18 0%, #0d1320 100%)" : "transparent"};
                color: #f8fafc;
                font-size: 18px;
                font-weight: 700;
                cursor: pointer;
                line-height: 1;
                display:flex;
                align-items:center;
                justify-content:center;
                opacity: ${size === "top" ? "1" : "0.9"};
            `;
            this.setObserverIconOnButton(
                btn,
                icon,
                size === "top" ? 22 : size === "camera" ? 19 : 26,
                size === "top" ? "#cbd5e1" : "#6b7280"
            );
            btn.onclick = onClick;
            return btn;
        };

        const stopBtn = makeBtn("stop", "Stop (S)", () => {
            void this.stopObserverRecording();
        }, "top");
        stopBtn.style.borderRadius = "22px";
        wrap.appendChild(stopBtn);

        const timer = document.createElement("div");
        timer.style.cssText = "font-size: 26px; font-weight: 740; letter-spacing: -0.02em; line-height: 1; color:#e2e8f0;";
        timer.textContent = "0:00";
        wrap.appendChild(timer);
        this.observerToolbarTimerEl = timer;

        const pauseBtn = makeBtn("pause", "Pausar (Space/K)", () => {
            void this.toggleObserverPauseResume();
        });
        wrap.appendChild(pauseBtn);
        this.observerToolbarPauseBtnEl = pauseBtn;

        const restartBtn = makeBtn("restart", "Restart recording (R)", () => {
            void this.restartObserverRecordingSegment();
        });
        wrap.appendChild(restartBtn);

        const discardBtn = makeBtn("trash", "Descartar (D)", () => {
            void this.discardObserverRecording();
        });
        wrap.appendChild(discardBtn);

        const sep = document.createElement("div");
        sep.style.cssText = "width:28px;height:1px;background:rgba(148,163,184,0.34);margin-top:2px;";
        wrap.appendChild(sep);

        const cameraBtn = makeBtn("camera", "Choose camera", () => {
            // Reserved for camera source picker in next iteration.
        }, "camera");
        cameraBtn.style.opacity = "0.95";
        wrap.appendChild(cameraBtn);
        this.observerToolbarHelpEl = null;

        document.body.appendChild(wrap);
        this.observerToolbarEl = wrap;
        if (this.observerToolbarPosition) {
            const rect = wrap.getBoundingClientRect();
            const clamped = this.clampObserverFloatingPosition(
                this.observerToolbarPosition.left,
                this.observerToolbarPosition.top,
                rect.width,
                rect.height
            );
            wrap.style.left = `${clamped.left}px`;
            wrap.style.top = `${clamped.top}px`;
            wrap.style.right = "auto";
            wrap.style.bottom = "auto";
            this.observerToolbarPosition = clamped;
        } else {
            wrap.style.left = `${defaultPos.left}px`;
            wrap.style.top = `${defaultPos.top}px`;
            wrap.style.right = "auto";
            wrap.style.bottom = "auto";
        }
        this.observerToolbarDragCleanup = this.makeObserverFloatingDraggable(
            wrap,
            (position) => {
                this.observerToolbarPosition = position;
            },
            (target) => target instanceof Element && target.closest("button") !== null
        );

        this.updateObserverToolbarUi();
        if (this.observerToolbarTimerInterval !== null) {
            window.clearInterval(this.observerToolbarTimerInterval);
        }
        this.observerToolbarTimerInterval = window.setInterval(() => {
            this.updateObserverToolbarUi();
        }, 250);

        const onShortcut = (evt: KeyboardEvent) => {
            if (!this.observerSessionId || this.observerStopping) return;
            const target = evt.target as HTMLElement | null;
            if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
            const key = evt.key.toLowerCase();
            if (key === " " || key === "k") {
                evt.preventDefault();
                void this.toggleObserverPauseResume();
                return;
            }
            if (key === "s") {
                evt.preventDefault();
                void this.stopObserverRecording();
                return;
            }
            if (key === "d") {
                evt.preventDefault();
                void this.discardObserverRecording();
                return;
            }
            if (key === "r") {
                evt.preventDefault();
                void this.restartObserverRecordingSegment();
            }
        };
        window.addEventListener("keydown", onShortcut, true);
        this.observerShortcutListener = onShortcut;
    }

    private unmountObserverToolbar() {
        if (this.observerToolbarTimerInterval !== null) {
            window.clearInterval(this.observerToolbarTimerInterval);
            this.observerToolbarTimerInterval = null;
        }
        if (this.observerShortcutListener) {
            window.removeEventListener("keydown", this.observerShortcutListener, true);
            this.observerShortcutListener = null;
        }
        if (this.observerToolbarEl) {
            this.observerToolbarEl.remove();
        }
        if (this.observerToolbarDragCleanup) {
            this.observerToolbarDragCleanup();
            this.observerToolbarDragCleanup = null;
        }
        this.observerToolbarEl = null;
        this.observerToolbarTimerEl = null;
        this.observerToolbarPauseBtnEl = null;
        this.observerToolbarHelpEl = null;
    }

    private mountObserverSetupToolbar() {
        if (typeof document === "undefined") return;
        this.unmountObserverSetupToolbar();
        const pos = this.getObserverToolbarDefaultPosition();

        const wrap = document.createElement("div");
        wrap.id = "luma-observer-setup-toolbar";
        wrap.style.cssText = `
            position: fixed;
            top: ${pos.top}px;
            left: ${pos.left}px;
            width: 86px;
            border-radius: 42px;
            background: linear-gradient(180deg,#1b2231 0%, #101827 100%);
            border: 1px solid rgba(148,163,184,0.32);
            box-shadow: 0 22px 44px rgba(2,6,23,0.48);
            z-index: 2147483647;
            padding: 10px 6px 10px;
            display:flex;
            flex-direction:column;
            align-items:center;
            gap:10px;
            user-select:none;
            pointer-events:none;
        `;

        const topBtn = document.createElement("div");
        topBtn.style.cssText = `
            width:56px;height:56px;border-radius:20px;
            border:1.5px solid rgba(251,113,133,0.35);
            background:linear-gradient(180deg,#0a0f18 0%, #0d1320 100%);
            display:flex;align-items:center;justify-content:center;
        `;
        topBtn.appendChild(this.createObserverIcon("stop", 19, "#e2e8f0"));
        wrap.appendChild(topBtn);

        const timer = document.createElement("div");
        timer.textContent = "0:00";
        timer.style.cssText = "font-size:26px;font-weight:740;letter-spacing:-0.02em;line-height:1;color:#e2e8f0;";
        wrap.appendChild(timer);

        const actionIcon = (name: ObserverIconName) => {
            const box = document.createElement("div");
            box.style.cssText = `
                width:58px;height:58px;border-radius:20px;
                border:0;
                background:transparent;
                display:flex;align-items:center;justify-content:center;
                opacity:.9;
            `;
            box.appendChild(this.createObserverIcon(name, 22, "#6b7280"));
            return box;
        };
        wrap.appendChild(actionIcon("pause"));
        wrap.appendChild(actionIcon("restart"));
        wrap.appendChild(actionIcon("trash"));

        document.body.appendChild(wrap);
        this.observerSetupToolbarEl = wrap;
    }

    private unmountObserverSetupToolbar() {
        if (this.observerSetupToolbarEl) {
            this.observerSetupToolbarEl.remove();
        }
        this.observerSetupToolbarEl = null;
    }

    private mountObserverCameraPreview(stream: MediaStream) {
        if (typeof document === "undefined") return;
        this.unmountObserverCameraPreview();

        const tracks = stream.getVideoTracks();
        if (!tracks.length) return;

        const existing = document.getElementById("luma-observer-camera-preview");
        if (existing) existing.remove();

        const wrap = document.createElement("div");
        wrap.id = "luma-observer-camera-preview";
        wrap.style.cssText = `
            position: fixed;
            right: 18px;
            bottom: 132px;
            width: 132px;
            height: 132px;
            border-radius: 999px;
            overflow: hidden;
            background: #0f172a;
            border: 2px solid rgba(255,255,255,0.92);
            box-shadow: 0 18px 35px rgba(2,6,23,0.44);
            z-index: 2147483647;
            pointer-events: auto;
            cursor: grab;
        `;

        const video = document.createElement("video");
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        video.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: cover;
            transform: scaleX(-1);
            display: block;
        `;

        wrap.appendChild(video);
        document.body.appendChild(wrap);
        if (this.observerCameraPreviewPosition) {
            const rect = wrap.getBoundingClientRect();
            const clamped = this.clampObserverFloatingPosition(
                this.observerCameraPreviewPosition.left,
                this.observerCameraPreviewPosition.top,
                rect.width,
                rect.height
            );
            wrap.style.left = `${clamped.left}px`;
            wrap.style.top = `${clamped.top}px`;
            wrap.style.right = "auto";
            wrap.style.bottom = "auto";
            this.observerCameraPreviewPosition = clamped;
        } else {
            this.positionObserverCameraNearToolbar(wrap);
        }
        this.observerCameraPreviewDragCleanup = this.makeObserverFloatingDraggable(wrap, (position) => {
            this.observerCameraPreviewPosition = position;
        });
        this.observerCameraPreviewEl = wrap;
        this.observerCameraPreviewVideoEl = video;

        const playAttempt = video.play();
        if (playAttempt && typeof playAttempt.catch === "function") {
            playAttempt.catch(() => {
                // The stream is still active even if the browser blocks autoplay.
            });
        }
    }

    private mountObserverCameraPreviewPlaceholder() {
        if (typeof document === "undefined") return;
        this.unmountObserverCameraPreview();

        const existing = document.getElementById("luma-observer-camera-preview");
        if (existing) existing.remove();

        const wrap = document.createElement("div");
        wrap.id = "luma-observer-camera-preview";
        wrap.style.cssText = `
            position: fixed;
            right: 18px;
            bottom: 132px;
            width: 132px;
            height: 132px;
            border-radius: 999px;
            overflow: hidden;
            background: radial-gradient(circle at 30% 30%, #1f2937 0%, #0f172a 70%);
            border: 2px solid rgba(255,255,255,0.92);
            box-shadow: 0 18px 35px rgba(2,6,23,0.44);
            z-index: 2147483647;
            pointer-events: none;
            display:flex;
            align-items:center;
            justify-content:center;
        `;
        wrap.appendChild(this.createObserverIcon("camera", 30, "#cbd5e1"));
        document.body.appendChild(wrap);
        this.positionObserverCameraNearToolbar(wrap);
        this.observerCameraPreviewEl = wrap;
        this.observerCameraPreviewVideoEl = null;
    }

    private unmountObserverCameraPreview() {
        if (this.observerCameraPreviewVideoEl) {
            try {
                this.observerCameraPreviewVideoEl.pause();
            } catch {
                // no-op
            }
            this.observerCameraPreviewVideoEl.srcObject = null;
        }
        if (this.observerCameraPreviewEl) {
            this.observerCameraPreviewEl.remove();
        }
        if (this.observerCameraPreviewDragCleanup) {
            this.observerCameraPreviewDragCleanup();
            this.observerCameraPreviewDragCleanup = null;
        }
        this.observerCameraPreviewEl = null;
        this.observerCameraPreviewVideoEl = null;
    }

    private async toggleObserverPauseResume() {
        const recorder = this.observerMediaRecorder;
        if (!recorder || !this.observerSessionId) return;
        if (recorder.state === "inactive") return;

        if (!this.observerPaused && recorder.state === "recording") {
            try {
                if (typeof recorder.pause === "function") recorder.pause();
            } catch { /* ignore */ }
            this.observerPaused = true;
            this.observerPausedAt = Date.now();
            this.updateObserverToolbarUi();
            this.assistant.addMessage("bot", "Lumen pausado.");
            return;
        }

        if (this.observerPaused && recorder.state === "paused") {
            try {
                if (typeof recorder.resume === "function") recorder.resume();
            } catch { /* ignore */ }
            this.observerPaused = false;
            this.observerPausedAccumulatedMs += Math.max(0, Date.now() - this.observerPausedAt);
            this.observerPausedAt = 0;
            this.updateObserverToolbarUi();
            this.assistant.addMessage("bot", "Lumen reanudado.");
        }
    }

    private async restartObserverRecordingSegment() {
        if (!this.observerSessionId || this.observerStopping) return;
        const recorder = this.observerMediaRecorder;
        if (!recorder || recorder.state === "inactive") return;
        try {
            if (this.observerPaused && recorder.state === "paused" && typeof recorder.resume === "function") {
                recorder.resume();
            }
        } catch {
            // ignore
        }
        this.observerVideoChunks = [];
        this.observerEvents = [];
        this.observerStartedAt = Date.now();
        this.observerPaused = false;
        this.observerPausedAt = 0;
        this.observerPausedAccumulatedMs = 0;
        this.updateObserverToolbarUi();
        this.assistant.addMessage("bot", "Lumen reiniciado.");
    }

    private async discardObserverRecording() {
        if (!this.observerSessionId) return;
        this.observerStopping = true;
        this.setObserverButtonState("processing");
        try {
            this.unmountObserverToolbar();
            this.unmountObserverCameraPreview();
            await this.detachWebMCPObserver();
            if (this.observerMediaRecorder && this.observerMediaRecorder.state !== "inactive") {
                this.observerMediaRecorder.stop();
            }
            for (const track of this.observerMediaStream?.getTracks() || []) track.stop();
            for (const track of this.observerMicStream?.getTracks() || []) track.stop();
            for (const track of this.observerCameraStream?.getTracks() || []) track.stop();
            this.cleanupObserverState();
            this.setObserverButtonState("idle");
            this.assistant.addMessage("bot", "Lumen descartado.");
        } catch (error) {
            console.error("LumaWay SDK: observer discard failed", error);
            this.cleanupObserverState();
            this.setObserverButtonState("error");
        } finally {
            this.observerStopping = false;
        }
    }

    private async startObserverRecording(options: ObserverStartOptions) {
        if (!this.observerEnabled || this.observerSessionId) return;
        if (!navigator.mediaDevices?.getDisplayMedia) {
            this.setObserverButtonState("error");
            this.assistant.addMessage("bot", "Lumen mode no está disponible en este navegador.");
            return;
        }

        const observerSettingAudio = Boolean(this.projectConfig?.settings?.observerMode?.captureAudio);
        const captureSystemAudio = observerSettingAudio && options.captureSystemAudio;
        const captureMicrophone = options.captureMicrophone;
        const requestCameraPermission = options.captureCamera;

        try {
            this.setObserverButtonState("processing");
            const started = await this.client.startLumen("");
            this.observerSessionId = started.observerSessionId;
            this.observerEvents = [];
            this.observerVideoChunks = [];
            this.observerStartedAt = Date.now();
            this.observerPaused = false;
            this.observerPausedAt = 0;
            this.observerPausedAccumulatedMs = 0;

            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: captureSystemAudio,
            });

            let micAudioTracks: MediaStreamTrack[] = [];
            if (navigator.mediaDevices?.getUserMedia && (captureMicrophone || requestCameraPermission)) {
                try {
                    const mediaStream = await navigator.mediaDevices.getUserMedia({
                        audio: captureMicrophone
                            ? {
                                echoCancellation: true,
                                noiseSuppression: true,
                                autoGainControl: true,
                            }
                            : false,
                        video: requestCameraPermission,
                    });
                    if (captureMicrophone) {
                        micAudioTracks = mediaStream.getAudioTracks();
                        this.observerMicStream = new MediaStream(micAudioTracks);
                    }
                    if (requestCameraPermission) {
                        const cameraTracks = mediaStream.getVideoTracks();
                        if (cameraTracks.length > 0) {
                            this.observerCameraStream = new MediaStream(cameraTracks);
                            this.mountObserverCameraPreview(this.observerCameraStream);
                        }
                    }
                } catch (mediaError) {
                    console.warn("LumaWay SDK: Could not grant microphone/camera permissions", mediaError);
                }
            }

            let stream = new MediaStream([
                ...displayStream.getVideoTracks(),
                ...displayStream.getAudioTracks(),
                ...micAudioTracks,
            ]);
            let audioTracksCount = stream.getAudioTracks().length;

            // Browser may provide screen video without audio track even when audio=true.
            // Fallback to microphone to keep narration in the Lumen recording.
            if (captureSystemAudio && audioTracksCount === 0 && captureMicrophone && navigator.mediaDevices?.getUserMedia) {
                try {
                    const micStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                        },
                    });
                    this.observerMicStream = micStream;
                    stream = new MediaStream([
                        ...displayStream.getVideoTracks(),
                        ...micStream.getAudioTracks(),
                    ]);
                    audioTracksCount = stream.getAudioTracks().length;
                    console.log("LumaWay SDK: Lumen recording audio fallback enabled (microphone)");
                } catch (micError) {
                    console.warn("LumaWay SDK: Lumen recording could not enable microphone fallback", micError);
                }
            }

            this.observerMediaStream = stream;
            if ((captureSystemAudio || captureMicrophone) && audioTracksCount === 0) {
                this.assistant.addMessage(
                    "bot",
                    "Lumen inició sin pista de audio. Verifica compartir audio del sistema o permisos de micrófono."
                );
            }
            const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
                ? "video/webm;codecs=vp9"
                : "video/webm";

            const recorder = new MediaRecorder(stream, { mimeType });
            recorder.ondataavailable = (event: BlobEvent) => {
                if (event.data && event.data.size > 0) {
                    this.observerVideoChunks.push(event.data);
                }
            };

            recorder.start(1000);
            this.observerMediaRecorder = recorder;
            const usingWebMCPObserver = await this.attachWebMCPObserverIfAvailable();
            if (!usingWebMCPObserver) {
                this.attachObserverListeners();
            }
            this.mountObserverToolbar();
            console.log("LumaWay SDK: Lumen capture source", { source: this.observerCaptureSource });
            this.setObserverButtonState("recording");
            this.assistant.addMessage("bot", "Lumen activo. Pulsa Stop Lumen cuando termines.");
        } catch (error) {
            console.error("LumaWay SDK: observer start failed", error);
            await this.detachWebMCPObserver();
            this.cleanupObserverState();
            this.setObserverButtonState("error");
            this.assistant.addMessage("bot", "No se pudo iniciar el Lumen.");
        }
    }

    private async stopObserverRecording() {
        if (!this.observerSessionId || this.observerStopping) return;
        this.observerStopping = true;
        this.setObserverButtonState("processing");
        this.unmountObserverToolbar();
        this.unmountObserverCameraPreview();

        const sessionId = this.observerSessionId;
        const durationMs = this.getObserverElapsedMs();

        try {
            const videoBlob = await this.stopObserverRecorderToBlob();
            await this.detachWebMCPObserver();
            if (this.observerEvents.length > 0) {
                const chunkSize = 500;
                for (let i = 0; i < this.observerEvents.length; i += chunkSize) {
                    await this.client.ingestLumenEvents(sessionId, this.observerEvents.slice(i, i + chunkSize));
                }
            }

            let videoS3Key: string | undefined;
            if (videoBlob && videoBlob.size > 0) {
                const signed = await this.client.signLumenUpload("lumen-recording.webm");
                const headers = { "Content-Type": videoBlob.type || "video/webm", ...(signed.headers || {}) };
                const uploadResp = await fetch(signed.signedUrl, {
                    method: "PUT",
                    headers,
                    body: videoBlob,
                });
                if (!uploadResp.ok) throw new Error("Video upload failed");
                videoS3Key = signed.lumenS3Key || signed.s3Key;
            }

            await this.client.finalizeLumen(sessionId, {
                lumenS3Key: videoS3Key,
                captureSource: this.observerCaptureSource === "none" ? "unknown" : this.observerCaptureSource,
                videoDurationMs: durationMs,
            });

            this.assistant.addMessage("bot", "Lumen enviado. Ahora puedes revisarlo en el CMS.");
            this.cleanupObserverState();
            this.setObserverButtonState("idle");
        } catch (error) {
            console.error("LumaWay SDK: observer stop failed", error);
            await this.detachWebMCPObserver();
            this.cleanupObserverState();
            this.setObserverButtonState("error");
            this.assistant.addMessage("bot", "La sesión se detuvo con error. Reintenta.");
        } finally {
            this.observerStopping = false;
        }
    }

    private async stopObserverRecorderToBlob(): Promise<Blob | null> {
        const recorder = this.observerMediaRecorder;
        if (!recorder) return null;

        const blobPromise = new Promise<Blob | null>((resolve) => {
            recorder.onstop = () => {
                const type = recorder.mimeType || "video/webm";
                resolve(this.observerVideoChunks.length ? new Blob(this.observerVideoChunks, { type }) : null);
            };
        });

        recorder.stop();
        for (const track of this.observerMediaStream?.getTracks() || []) {
            track.stop();
        }
        for (const track of this.observerMicStream?.getTracks() || []) {
            track.stop();
        }
        for (const track of this.observerCameraStream?.getTracks() || []) {
            track.stop();
        }

        return await blobPromise;
    }

    private cleanupObserverState() {
        for (const fn of this.observerCleanupFns) fn();
        this.observerCleanupFns = [];
        this.unmountObserverToolbar();
        this.unmountObserverSetupToolbar();
        this.unmountObserverCameraPreview();
        for (const track of this.observerSetupCameraStream?.getTracks() || []) {
            track.stop();
        }
        for (const track of this.observerMediaStream?.getTracks() || []) {
            track.stop();
        }
        for (const track of this.observerMicStream?.getTracks() || []) {
            track.stop();
        }
        for (const track of this.observerCameraStream?.getTracks() || []) {
            track.stop();
        }
        this.observerWebMCPAdapter = null;
        this.observerCaptureSource = "none";
        this.observerSessionId = null;
        this.observerMediaRecorder = null;
        this.observerMediaStream = null;
        this.observerMicStream = null;
        this.observerSetupCameraStream = null;
        this.observerCameraStream = null;
        this.observerVideoChunks = [];
        this.observerEvents = [];
        this.observerStartedAt = 0;
        this.observerPaused = false;
        this.observerPausedAt = 0;
        this.observerPausedAccumulatedMs = 0;
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

    private applyRuntimeLocale(locale: string) {
        const normalized = String(locale || "en").trim() || "en";
        this.context.locale = normalized;
        this.strings = resolveSdkStrings(normalized);
        this.assistant.setLocale(normalized);
        this.tooltip.setLocale(normalized);
        this.automationOverlay.setLocale(normalized);
    }

    private applyRuntimeTheme(theme: "light" | "dark") {
        this.uiTheme = theme;
        this.assistant.setTheme(theme);
        const root = document.documentElement;
        root.setAttribute("data-luma-theme", theme);
        root.classList.toggle("dark", theme === "dark");
    }

    /**
     * Check if WebMCP is available in the browser
     */
    private checkWebMCPAvailable(): boolean {
        if (typeof window === 'undefined') {
            return false;
        }
        const mcp = (window as any).mcp;
        return Boolean(mcp && typeof mcp.callTool === "function");
    }

    private async refreshWebMCPDiagnostics() {
        const bridgeDetected = this.checkWebMCPAvailable();
        let webFillAvailable = false;
        if (bridgeDetected) {
            const mcp = (window as any).mcp;
            try {
                if (typeof mcp?.listTools === "function") {
                    const tools = await mcp.listTools();
                    if (Array.isArray(tools)) {
                        webFillAvailable = tools.some((t: any) => {
                            const name = String(t?.name || "");
                            return name === "web.fill" || name.endsWith(".web.fill");
                        });
                    }
                } else {
                    // If listTools is unavailable but callTool exists, assume runtime-provided tools.
                    webFillAvailable = true;
                }
            } catch {
                webFillAvailable = false;
            }
        }

        this.webMCPDiagnostics = {
            bridgeDetected,
            webFillAvailable,
            checkedAt: Date.now(),
        };
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

    /**
     * Controlled invalidation entry-point for host apps.
     * Use this after mutations or external sync events.
     */
    public invalidateApiCache(scope: "all" | "project" | "walkthroughs" | "versions" = "all", walkthroughId?: string) {
        this.client.invalidateApiCache(scope, walkthroughId);
    }

    /**
     * Hard reset for cached API resources in the current session scope.
     * Use on logout/session switch when needed.
     */
    public clearApiCache() {
        this.client.clearApiCache();
    }

    private logStep(step: string, data?: unknown) {
        if (this.debugMode) {
            console.log(`[LumaWay SDK:DEBUG] ${step}`, data !== undefined ? data : "");
        }
    }

    public emitEvent(event: LumaEvent): Promise<void> {
        if (this.suppressInteractionEvents && event.type === "interaction.detected") {
            this.logStep("event.suppressed", { type: event.type, reason: "automation-assist" });
            return Promise.resolve();
        }
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
                this.assistant.notifyUnread(this.strings.walkthroughCompleted);
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
        const normalizedIntent = this.normalizeIntentText(intent);
        const now = Date.now();
        const isCommandIntent = normalizedIntent.startsWith("__luma_");
        if (!isCommandIntent) {
            if (this.automationInFlight || now < this.automationCooldownUntil) {
                this.logStep("trackIntent: blocked-by-automation-window", { intent: normalizedIntent });
                return;
            }
            if (this.lastTrackedIntent && this.lastTrackedIntent.text === normalizedIntent && now - this.lastTrackedIntent.at < 3500) {
                this.logStep("trackIntent: deduped", { intent: normalizedIntent });
                return;
            }
            this.lastTrackedIntent = { text: normalizedIntent, at: now };
        }
        if (
            normalizedIntent === "webmcp status"
            || normalizedIntent === "estado webmcp"
            || normalizedIntent === "diagnostico webmcp"
            || normalizedIntent === "diagnostico mcp"
            || normalizedIntent === "mcp status"
        ) {
            await this.refreshWebMCPDiagnostics();
            const d = this.webMCPDiagnostics;
            const enabled = this.webMCPConfig?.enabled !== false;
            const statusMsg = [
                this.isSpanishLocale() ? `Diagnóstico WebMCP` : `WebMCP diagnostics`,
                `- enabled config: ${enabled ? "true" : "false"}`,
                `- bridge detected: ${d.bridgeDetected ? "true" : "false"}`,
                `- tool web.fill: ${d.webFillAvailable ? "available" : "not available"}`,
            ].join("\n");
            this.assistant.addMessage("bot", statusMsg);
            return;
        }

        if (intent === "__luma_assist_apply__") {
            await this.applyPendingAssistPlan();
            return;
        }
        if (intent === "__luma_browser_run__") {
            await this.applyPendingBrowserFlowPlan();
            return;
        }

        this.logStep("trackIntent: send", { intent: intent.slice(0, 80) });
        this.pushIntentSignal("chat", intent);
        this.assistant.setTyping(true);
        this.startThinkingAudio();
        let lastStreamPaintAt = 0;
        try {
            const response = await this.client.sendChatMessage(intent, {
                userId: this.context.userId,
                locale: this.context.locale,
            }, {
                onStatus: (status) => {
                    this.logStep("trackIntent: status", { status });
                    this.assistant.setTyping(true);
                },
                onChunk: (partial) => {
                    const now = Date.now();
                    if (now - lastStreamPaintAt < LumaSDK.STREAM_PAINT_THROTTLE_MS) return;
                    lastStreamPaintAt = now;
                    this.stopThinkingAudio();
                    this.audio.play("typing");
                    this.assistant.setStreamingBotMessage(partial);
                }
            });
            this.logStep("trackIntent: response", { message: response.message?.slice(0, 60), actionsCount: response.actions?.length ?? 0, executeWalkthrough: response.executeWalkthrough ?? null });
            this.pendingAssistPlan = response.assistPlan || null;
            this.pendingBrowserFlowPlan = response.browserFlowPlan || null;

            // Show AI response with action buttons inside the bubble.
            // The walkthrough ONLY starts when the user explicitly clicks one of these buttons.
            // Do NOT auto-execute executeWalkthrough — that bypasses user intentionality.
            this.assistant.clearStreamingBotMessage();
            this.assistant.addMessage("bot", response.message, response.actions);
            this.audio.play("message");
            if ((response.actions || []).some((a) => a.action === "__luma_assist_apply__" || a.action === "__luma_browser_run__")) {
                this.audio.play("action_required");
            }

        } catch (error) {
            console.warn("LumaWay SDK: AI chat socket failed", error);
            const diag = this.client.getSocketDiagnostics();
            const reason = (error as any)?.message || diag.lastError || "sin detalle";
            this.assistant.clearStreamingBotMessage();
            this.assistant.addMessage(
                "bot",
                this.isSpanishLocale()
                    ? `No pude conectar el canal en tiempo real del chat. Motivo: ${reason}. Verifica backend/socket y vuelve a intentar.`
                    : `I could not connect the realtime chat channel. Reason: ${reason}. Verify backend/socket and retry.`
            );
            this.audio.play("error");
        } finally {
            this.stopThinkingAudio();
            this.assistant.clearStreamingBotMessage();
            this.assistant.setTyping(false);
        }
    }

    private async applyPendingAssistPlan() {
        const plan = this.pendingAssistPlan;
        if (!plan || !Array.isArray(plan.fields) || plan.fields.length === 0) {
            this.assistant.addMessage("bot", this.isSpanishLocale()
                ? "No tengo datos sugeridos para aplicar en este momento."
                : "I don't have suggested data to apply right now.");
            return;
        }
        this.pendingAssistPlan = null;
        this.automationStopped = false;
        this.automationPaused = false;
        this.suppressInteractionEvents = true;
        this.automationOverlay.show("Aplicando datos sugeridos en la interfaz.");

        let applied = 0;
        try {
            for (let idx = 0; idx < plan.fields.length; idx += 1) {
                const field = plan.fields[idx];
                if (!field) continue;
                if (this.automationStopped) break;
                await this.waitWhilePaused();
                this.automationOverlay.setProgress(idx + 1, plan.fields.length, field.stepId || "campo");
                const ok = await this.applyAssistField(field.target, field.value);
                if (ok) {
                    applied += 1;
                    await new Promise((r) => setTimeout(r, 220));
                }
            }
        } finally {
            this.suppressInteractionEvents = false;
            this.automationOverlay.hide();
        }

        if (applied > 0) {
            this.assistant.addMessage(
                "bot",
                this.isSpanishLocale()
                    ? `Apliqué ${applied} campo(s) sugeridos. Revisa los datos y confirma el envío cuando estés listo.`
                    : `I applied ${applied} suggested field(s). Review the data and confirm shipment when ready.`
            );
            this.audio.play("success");
        } else {
            this.assistant.addMessage(
                "bot",
                this.isSpanishLocale()
                    ? "No pude aplicar los datos automáticamente en esta pantalla. Si quieres, te guío paso a paso."
                    : "I could not apply the data automatically on this screen. I can guide you step by step."
            );
            this.audio.play("error");
        }
    }

    private async applyPendingBrowserFlowPlan() {
        const plan = this.pendingBrowserFlowPlan;
        if (!plan || !Array.isArray(plan.steps) || plan.steps.length === 0) {
            this.assistant.addMessage("bot", this.isSpanishLocale()
                ? "No tengo un flujo automático listo para ejecutar en este momento."
                : "I don't have an automatic flow ready to run right now.");
            return;
        }
        this.pendingBrowserFlowPlan = null;
        this.automationInFlight = true;
        this.automationStopped = false;
        this.automationPaused = false;
        this.assistant.setAutomationChatLock(true);
        this.assistant.close();
        this.automationOverlay.show("AutoPilot ejecutando");
        this.assistant.addMessage("bot", this.isSpanishLocale()
            ? "Estoy ejecutando el flujo automático ahora. Te voy mostrando el resultado."
            : "I'm running the automatic flow now. I'll show you progress.");
        this.audio.play("action_required");

        try {
            // Host-first execution: apply actions in the current user page so the UI changes are visible.
            const hostResult = await this.executeBrowserFlowOnHost(plan.steps);
            const hostExecuted = hostResult.executed;
            let executed = hostExecuted;
            let failedSummary = hostResult.failed.slice(0, 3).map((f) => `${f.tool}${f.selector ? `(${f.selector})` : ''}`).join(", ");

            // Optional fallback to remote Browser MCP only if nothing was applied locally.
            if (executed === 0) {
                const result = await this.client.callBrowserMcpTool("runFlow", {
                    steps: plan.steps,
                    retryPerStep: 2,
                    continueOnError: true,
                });
                if (result?.ok) {
                    executed = Array.isArray((result.data as any)?.steps)
                        ? (result.data as any).steps.filter((s: any) => s?.ok).length
                        : 0;
                    if (executed === 0) {
                        const remoteFailed = Array.isArray((result.data as any)?.steps)
                            ? ((result.data as any).steps as any[]).filter((s: any) => !s?.ok).slice(0, 3).map((s: any) => s?.tool)
                            : [];
                        if (remoteFailed.length > 0) {
                            failedSummary = remoteFailed.join(", ");
                        }
                    }
                } else if (result?.error) {
                    this.logStep("browser.runFlow.remote.failed", { error: result.error });
                    failedSummary = result.error;
                }
            }

            this.assistant.addMessage(
                "bot",
                executed > 0
                    ? `${plan.summary || "Flujo automático ejecutado"}. Se completaron ${executed} acción(es). Revisa los cambios y confirma antes de finalizar.`
                    : (this.isSpanishLocale()
                        ? `No pude aplicar acciones automáticamente en esta pantalla. Fallos detectados: ${failedSummary || "sin detalle"}. Te recomiendo iniciar el paso a paso para alinear selectores/ruta.`
                        : `I could not apply actions automatically on this screen. Detected failures: ${failedSummary || "no details"}. I recommend starting guided steps to align selectors/route.`)
            );
            this.audio.play(executed > 0 ? "success" : "error");
        } catch (error: any) {
            this.assistant.addMessage(
                "bot",
                `No se pudo ejecutar Browser MCP: ${error?.message || "error de conexión"}.`
            );
            this.audio.play("error");
        } finally {
            this.authorizeResolver = null;
            this.automationOverlay.hide();
            this.hideAutomationCursor();
            this.hideAuthorizationTargetFocus();
            this.assistant.setAutomationChatLock(false);
            this.automationInFlight = false;
            this.automationCooldownUntil = Date.now() + 1800;
        }
    }

    private async executeBrowserFlowOnHost(
        steps: Array<{ tool: string; args?: Record<string, unknown> }>
    ): Promise<{ executed: number; failed: Array<{ tool: string; selector?: string }> }> {
        let executed = 0;
        const failed: Array<{ tool: string; selector?: string }> = [];
        for (let idx = 0; idx < steps.length; idx += 1) {
            const step = steps[idx];
            if (!step) continue;
            if (this.automationStopped) break;
            await this.waitWhilePaused();
            const selector = typeof step.args?.selector === "string" ? step.args.selector : undefined;
            this.automationOverlay.setProgress(idx + 1, steps.length, step.tool);
            const ok = await this.executeHostStepWithRetry(step.tool, step.args || {}, 3);
            if (ok) {
                executed += 1;
                // Small pacing so user can perceive the guided interaction.
                await new Promise((r) => setTimeout(r, 280));
            } else {
                failed.push({ tool: step.tool, selector });
            }
        }
        return { executed, failed };
    }

    private async executeHostStepWithRetry(
        tool: string,
        args: Record<string, unknown>,
        attempts: number
    ): Promise<boolean> {
        for (let i = 1; i <= attempts; i += 1) {
            const ok = await this.executeHostStep(tool, args);
            if (ok) return true;
            if (i < attempts) {
                await new Promise((r) => setTimeout(r, 200 * i));
            }
        }
        return false;
    }

    private async executeHostStep(tool: string, args: Record<string, unknown>): Promise<boolean> {
        const selector = typeof args.selector === "string" ? args.selector : "";
        const timeout = typeof args.timeout === "number" ? args.timeout : 4000;

        const waitForSelector = async (sel: string, ms: number): Promise<Element | null> => {
            const start = Date.now();
            while (Date.now() - start < ms) {
                const el = document.querySelector(sel);
                if (el) return el;
                await new Promise((r) => setTimeout(r, 80));
            }
            return null;
        };

        try {
            if (this.automationStopped) return false;
            if (this.isSensitiveStep(tool, args)) {
                const allowed = await this.requireStepAuthorization(tool, args);
                if (!allowed) return false;
            }
            switch (tool) {
                case "waitFor": {
                    if (selector) {
                        const el = await waitForSelector(selector, timeout);
                        return Boolean(el);
                    }
                    await new Promise((r) => setTimeout(r, timeout));
                    return true;
                }
                case "navigate": {
                    const url = typeof args.url === "string" ? args.url : "";
                    if (!url) return false;
                    const route = this.normalizeHostRoute(url);
                    const expectedPath = route.startsWith("/")
                        ? route.split(/[?#]/)[0]
                        : this.normalizeHostRoute(`/${route}`).split(/[?#]/)[0];
                    const routeAnchor = expectedPath
                        ? (document.querySelector(`a[href="${expectedPath}"]`)
                            || document.querySelector(`a[href$="${expectedPath}"]`)
                            || document.querySelector(`[data-route="${expectedPath}"]`))
                        : null;
                    let anchorClicked = false;
                    if (routeAnchor instanceof HTMLElement) {
                        await this.animateAutomationCursorToElement(routeAnchor);
                        this.playAutomationCursorClickFeedback();
                        routeAnchor.click();
                        anchorClicked = true;
                    }
                    if (!anchorClicked) {
                        if (this.config.onNavigate) {
                            this.config.onNavigate(route);
                        } else {
                            window.location.href = route;
                        }
                    }
                    const start = Date.now();
                    while (Date.now() - start < 3000) {
                        const currentPath = window.location.pathname || "/";
                        if (!expectedPath || currentPath === expectedPath || currentPath.startsWith(expectedPath)) {
                            return true;
                        }
                        await new Promise((r) => setTimeout(r, 80));
                    }
                    return false;
                }
                case "click": {
                    if (!selector) return false;
                    const el = await waitForSelector(selector, timeout);
                    if (!(el instanceof HTMLElement)) return false;
                    await this.animateAutomationCursorToElement(el);
                    el.scrollIntoView({ block: "center", behavior: "smooth" });
                    el.focus?.();
                    await new Promise((r) => setTimeout(r, 120));
                    this.playAutomationCursorClickFeedback();
                    el.click();
                    return true;
                }
                case "fill": {
                    if (!selector) return false;
                    const value = String(args.value ?? "");
                    const el = await waitForSelector(selector, timeout);
                    if (!el) return false;
                    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
                        await this.animateAutomationCursorToElement(el);
                        el.scrollIntoView({ block: "center", behavior: "smooth" });
                        el.focus();
                        await new Promise((r) => setTimeout(r, 100));
                        el.value = value;
                        el.dispatchEvent(new Event("input", { bubbles: true }));
                        el.dispatchEvent(new Event("change", { bubbles: true }));
                        return true;
                    }
                    if (el instanceof HTMLSelectElement) {
                        await this.animateAutomationCursorToElement(el);
                        el.scrollIntoView({ block: "center", behavior: "smooth" });
                        el.focus();
                        await new Promise((r) => setTimeout(r, 100));
                        el.value = value;
                        el.dispatchEvent(new Event("input", { bubbles: true }));
                        el.dispatchEvent(new Event("change", { bubbles: true }));
                        return true;
                    }
                    return false;
                }
                case "select": {
                    if (!selector) return false;
                    const el = await waitForSelector(selector, timeout);
                    if (!(el instanceof HTMLSelectElement)) return false;
                    await this.animateAutomationCursorToElement(el);
                    el.scrollIntoView({ block: "center", behavior: "smooth" });
                    el.focus();
                    await new Promise((r) => setTimeout(r, 100));
                    const value = typeof args.value === "string" ? args.value : "";
                    const label = typeof args.label === "string" ? args.label : "";
                    const index = typeof args.index === "number" ? args.index : -1;
                    if (value) {
                        el.value = value;
                    } else if (label) {
                        const opt = Array.from(el.options).find((o) => o.label === label || o.text === label);
                        if (!opt) return false;
                        el.value = opt.value;
                    } else if (index >= 0 && index < el.options.length) {
                        el.selectedIndex = index;
                    } else {
                        return false;
                    }
                    el.dispatchEvent(new Event("input", { bubbles: true }));
                    el.dispatchEvent(new Event("change", { bubbles: true }));
                    return true;
                }
                case "extractText":
                case "screenshot":
                    // Non-mutating tools are not needed for host-side UI automation confirmation.
                    return false;
                default:
                    return false;
            }
        } catch (error) {
            this.logStep("browser.host.step.failed", { tool, selector, error: String(error) });
            return false;
        }
    }

    private ensureAutomationCursor(): HTMLElement {
        if (this.autoCursorEl && this.autoCursorEl.isConnected) return this.autoCursorEl;
        this.ensureAutomationCursorStyle();
        const el = document.createElement("div");
        el.id = "luma-automation-cursor";
        el.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" focusable="false">
                <g>
                    <g data-name="Layer 2">
                        <circle cx="256" cy="256" r="256" fill="#1aa3ff"></circle>
                        <rect width="260" height="260" x="126" y="126" rx="130" fill="#ffffff"></rect>
                    </g>
                </g>
            </svg>
            <span class="luma-automation-cursor-ring"></span>
        `;
        el.style.cssText = `
            position: fixed;
            left: 0;
            top: 0;
            width: 18px;
            height: 18px;
            filter: drop-shadow(0 4px 10px rgba(15,23,42,0.4));
            transform: translate(-9999px, -9999px);
            z-index: 2147483647;
            pointer-events: none;
            transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 140ms ease;
            opacity: 0;
            will-change: transform, opacity;
        `;
        const svg = el.querySelector("svg") as SVGElement | null;
        if (svg) {
            svg.style.width = "100%";
            svg.style.height = "100%";
            svg.style.display = "block";
            svg.classList.add("luma-automation-cursor-core");
        }
        document.body.appendChild(el);
        this.autoCursorEl = el;
        return el;
    }

    private ensureAutomationCursorStyle() {
        if (document.getElementById("luma-automation-cursor-style")) return;
        const style = document.createElement("style");
        style.id = "luma-automation-cursor-style";
        style.textContent = `
            #luma-automation-cursor { position: fixed; }
            #luma-automation-cursor .luma-automation-cursor-ring {
                position: absolute;
                inset: -6px;
                border-radius: 999px;
                border: 1.5px solid rgba(56, 189, 248, 0.45);
                animation: luma-cursor-idle-ring 1.25s ease-in-out infinite;
                pointer-events: none;
            }
            #luma-automation-cursor .luma-automation-cursor-core {
                transform-origin: center;
            }
            #luma-automation-cursor.entering .luma-automation-cursor-core {
                animation: luma-cursor-enter-core 220ms cubic-bezier(0.22, 1, 0.36, 1);
            }
            #luma-automation-cursor.moving .luma-automation-cursor-core {
                animation: luma-cursor-moving-core 260ms cubic-bezier(0.22, 1, 0.36, 1);
            }
            #luma-automation-cursor.clicking .luma-automation-cursor-core {
                animation: luma-cursor-click-core 170ms ease-out;
            }
            #luma-automation-cursor.exiting .luma-automation-cursor-core {
                animation: luma-cursor-exit-core 160ms ease-in forwards;
            }
            @keyframes luma-cursor-idle-ring {
                0%, 100% { transform: scale(0.92); opacity: 0.18; }
                50% { transform: scale(1.14); opacity: 0.42; }
            }
            @keyframes luma-cursor-enter-core {
                0% { transform: scale(0.45); opacity: 0; }
                100% { transform: scale(1); opacity: 1; }
            }
            @keyframes luma-cursor-moving-core {
                0% { transform: scale(0.94); }
                55% { transform: scale(1.09); }
                100% { transform: scale(1); }
            }
            @keyframes luma-cursor-click-core {
                0% { transform: scale(1); }
                45% { transform: scale(0.78); }
                100% { transform: scale(1); }
            }
            @keyframes luma-cursor-exit-core {
                0% { transform: scale(1); opacity: 1; }
                100% { transform: scale(0.4); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    private async animateAutomationCursorToElement(el: Element): Promise<void> {
        const cursor = this.ensureAutomationCursor();
        const rect = el.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return;
        const x = Math.round(rect.left + Math.min(rect.width * 0.35, 24));
        const y = Math.round(rect.top + Math.min(rect.height * 0.5, 18));
        if (!this.autoCursorVisible) {
            this.autoCursorVisible = true;
            cursor.classList.add("entering");
            globalThis.setTimeout(() => cursor.classList.remove("entering"), 240);
        }
        cursor.classList.add("moving");
        globalThis.setTimeout(() => cursor.classList.remove("moving"), 280);
        cursor.style.opacity = "0.98";
        cursor.style.transform = `translate(${x}px, ${y}px)`;
        await new Promise((r) => setTimeout(r, 280));
    }

    private playAutomationCursorClickFeedback() {
        if (!this.autoCursorEl) return;
        this.autoCursorEl.classList.remove("clicking");
        // Force reflow so animation can retrigger reliably on repeated clicks.
        void this.autoCursorEl.offsetWidth;
        this.autoCursorEl.classList.add("clicking");
        globalThis.setTimeout(() => this.autoCursorEl?.classList.remove("clicking"), 200);
    }

    private hideAutomationCursor() {
        if (!this.autoCursorEl) return;
        this.autoCursorVisible = false;
        this.autoCursorEl.classList.add("exiting");
        const el = this.autoCursorEl;
        globalThis.setTimeout(() => {
            el.classList.remove("exiting", "entering", "moving", "clicking");
            el.style.opacity = "0";
            el.style.transform = "translate(-9999px, -9999px)";
        }, 170);
    }

    private startThinkingAudio() {
        this.stopThinkingAudio();
        this.audio.play("thinking");
        this.thinkingCueTimer = globalThis.setInterval(() => {
            this.audio.play("thinking");
        }, 1800);
    }

    private stopThinkingAudio() {
        if (this.thinkingCueTimer !== null) {
            globalThis.clearInterval(this.thinkingCueTimer);
            this.thinkingCueTimer = null;
        }
    }

    private async waitWhilePaused(): Promise<void> {
        while (this.automationPaused && !this.automationStopped) {
            await new Promise((r) => setTimeout(r, 120));
        }
    }

    private isSensitiveStep(tool: string, args: Record<string, unknown>): boolean {
        if (tool !== "click") return false;
        const selector = String(args.selector || "").toLowerCase();
        return (
            selector.includes("confirm")
            || selector.includes("submit")
            || selector.includes("final")
            || selector.includes("delete")
            || selector.includes("pagar")
            || selector.includes("payment")
        );
    }

    private async requireStepAuthorization(tool: string, args: Record<string, unknown>): Promise<boolean> {
        const selector = String(args.selector || "");
        await this.showAuthorizationTargetFocus(selector);
        this.automationOverlay.setNeedsAuthorization(
            true,
            this.isSpanishLocale()
                ? `Se requiere autorización para ejecutar "${tool}" en ${selector || "acción sensible"}.`
                : `Authorization is required to run "${tool}" on ${selector || "sensitive action"}.`
        );
        this.audio.play("authorization");
        return await new Promise<boolean>((resolve) => {
            this.authorizeResolver = resolve;
        });
    }

    private ensureAuthorizationFocusEl(): HTMLElement {
        if (this.authorizationFocusEl && this.authorizationFocusEl.isConnected) return this.authorizationFocusEl;
        const el = document.createElement("div");
        el.id = "luma-authorization-focus";
        el.style.cssText = `
            position: fixed;
            left: 0;
            top: 0;
            width: 0;
            height: 0;
            border-radius: 12px;
            border: 2px solid rgba(96,165,250,0.95);
            box-shadow:
                0 0 0 4px rgba(96,165,250,0.2),
                0 0 24px rgba(59,130,246,0.4),
                inset 0 0 0 1px rgba(255,255,255,0.35);
            background: rgba(59,130,246,0.06);
            pointer-events: none;
            z-index: 2147483647;
            opacity: 0;
            transition: opacity 120ms ease, transform 180ms ease, width 180ms ease, height 180ms ease;
        `;
        document.body.appendChild(el);
        this.authorizationFocusEl = el;
        return el;
    }

    private async showAuthorizationTargetFocus(selector: string): Promise<void> {
        this.hideAuthorizationTargetFocus();
        if (!selector) return;
        const target = document.querySelector(selector) as HTMLElement | null;
        if (!target) return;
        target.scrollIntoView({ block: "center", behavior: "smooth" });
        target.focus?.();
        await this.animateAutomationCursorToElement(target);
        const rect = target.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return;
        const focus = this.ensureAuthorizationFocusEl();
        const pad = 6;
        focus.style.left = `${Math.max(0, Math.round(rect.left - pad))}px`;
        focus.style.top = `${Math.max(0, Math.round(rect.top - pad))}px`;
        focus.style.width = `${Math.round(rect.width + pad * 2)}px`;
        focus.style.height = `${Math.round(rect.height + pad * 2)}px`;
        focus.style.opacity = "1";
    }

    private hideAuthorizationTargetFocus() {
        if (!this.authorizationFocusEl) return;
        this.authorizationFocusEl.style.opacity = "0";
        this.authorizationFocusEl.style.width = "0";
        this.authorizationFocusEl.style.height = "0";
    }

    private normalizeHostRoute(raw: string): string {
        const value = String(raw || "").trim();
        if (!value) return value;
        try {
            const url = new URL(value, window.location.origin);
            // For SPA routers, pass route path instead of absolute URL.
            return `${url.pathname}${url.search}${url.hash}` || "/";
        } catch {
            return value;
        }
    }

    private async applyAssistField(target: string, rawValue: string): Promise<boolean> {
        if (!target || typeof target !== "string") return false;
        const value = String(rawValue ?? "");

        // Prefer real WebMCP execution when available/configured.
        const webMCPEnabled = this.webMCPConfig?.enabled !== false;
        const mcp = (window as any).mcp;
        if (webMCPEnabled && mcp && typeof mcp.callTool === "function") {
            try {
                await mcp.callTool("web.fill", { selector: target, value });
                return true;
            } catch (error) {
                this.logStep("webmcp.fill.failed", { target, error: String(error) });
            }
        }

        // Local DOM fallback when WebMCP bridge is unavailable.
        const element = document.querySelector(target) as HTMLElement | null;
        if (!element) return false;

        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            element.focus();
            element.value = value;
            element.dispatchEvent(new Event("input", { bubbles: true }));
            element.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
        }

        if (element instanceof HTMLSelectElement) {
            element.value = value;
            element.dispatchEvent(new Event("input", { bubbles: true }));
            element.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
        }

        element.setAttribute("value", value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
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
        const enabled = this.webMCPConfig?.enabled !== false;
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
