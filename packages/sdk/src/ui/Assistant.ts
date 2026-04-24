import type { GuidancePlan } from "@luma/core";
import type { SdkI18nStrings } from "../i18n.js";
import { resolveSdkStrings } from "../i18n.js";

export interface ChatMessage {
    role: "user" | "bot";
    text: string;
    actions?: Array<{ label: string; action?: string; walkthroughId?: string; stepId?: string }>;
}

export interface AssistantOptions {
    initialMessages?: ChatMessage[];
    onMessageAdded?: (msg: ChatMessage) => void;
    locale?: string;
    strings?: SdkI18nStrings;
    theme?: "light" | "dark";
    onLocaleChange?: (locale: string) => void;
    onThemeChange?: (theme: "light" | "dark") => void;
    uiSettings?: ChatbotUiSettings;
}

export interface ChatbotUiSettings {
    template?: "default" | "compact" | "minimal";
    position?: "bottom-right" | "bottom-left";
    primaryColor?: string;
    secondaryColor?: string;
    surfaceColor?: string;
    chatWidth?: number;
    chatHeight?: number;
    triggerSize?: number;
}

/**
 * World-Class Luma Assistant UI
 * Encapsulated via Shadow DOM for absolute style isolation.
 * Framework-agnostic (Vanilla JS).
 */
export class Assistant {
    private host: HTMLElement;
    private shadowRoot: ShadowRoot;
    private container: HTMLElement;
    private chatWindow!: HTMLElement;
    private triggerButton!: HTMLElement;
    private messagesList!: HTMLElement;
    private typingRow: HTMLElement | null = null;
    private streamingRow: HTMLElement | null = null;
    private streamingBubble: HTMLElement | null = null;
    private progressPanel!: HTMLElement;
    private input!: HTMLInputElement;
    public isOpen: boolean = false;
    private lockClosedForAutomation = false;
    private lastStepId: string | null = null;
    private contextualSuggestions: Array<{ label: string; action?: string; walkthroughId?: string; stepId?: string }> = [];

    private onTrackIntent: (intent: string) => void;
    private onAdvanceStep: (walkthroughId: string, stepId: string) => void;
    private onMessageAdded?: (msg: ChatMessage) => void;
    private strings: SdkI18nStrings;
    private locale: string = "en";
    private theme: "light" | "dark" = "light";
    private onLocaleChange?: (locale: string) => void;
    private onThemeChange?: (theme: "light" | "dark") => void;
    private uiSettings: ChatbotUiSettings = {};

    constructor(
        onTrackIntent: (intent: string) => void,
        onAdvanceStep: (walkthroughId: string, stepId: string) => void,
        options?: AssistantOptions
    ) {
        this.onTrackIntent = onTrackIntent;
        this.onAdvanceStep = onAdvanceStep;
        this.onMessageAdded = options?.onMessageAdded;
        this.strings = options?.strings || resolveSdkStrings(options?.locale);
        this.locale = (options?.locale || "en").toLowerCase();
        this.theme = options?.theme || "light";
        this.onLocaleChange = options?.onLocaleChange;
        this.onThemeChange = options?.onThemeChange;
        this.uiSettings = options?.uiSettings || {};

        // 1. Create Host Element
        // Prevent duplicates: Remove existing instance if present
        const existingHost = document.getElementById("luma-assistant-host");
        if (existingHost) {
            existingHost.remove();
        }

        this.host = document.createElement("div");
        this.host.id = "luma-assistant-host";
        document.body.appendChild(this.host);

        // 2. Attach Shadow DOM
        this.shadowRoot = this.host.attachShadow({ mode: "open" });

        // 3. Inject Styles
        this.injectStyles();

        // 4. Create Main Container
        this.container = document.createElement("div");
        this.container.className = "luma-assistant-container";
        this.shadowRoot.appendChild(this.container);

        // 5. Create Components
        this.createTriggerButton();
        this.createChatWindow(options?.initialMessages);
        this.applyUiSettings(this.uiSettings);
    }

    private injectStyles() {
        const style = document.createElement("style");
        style.textContent = `
            :host {
                all: initial; /* Reset everything */
                font-family: 'Inter', system-ui, -apple-system, sans-serif;
            }

            .luma-assistant-container {
                position: fixed;
                bottom: 24px;
                right: 24px;
                z-index: 2147483647;
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                pointer-events: none;
                --luma-primary: #4f46e5;
                --luma-secondary: #9333ea;
                --luma-surface: #ffffff;
                --luma-chat-width: 380px;
                --luma-chat-height: 520px;
                --luma-trigger-size: 64px;
            }

            .luma-assistant-container * {
                box-sizing: border-box;
                pointer-events: auto;
            }

            /* --- Trigger Button --- */
            .luma-trigger {
                width: var(--luma-trigger-size);
                height: var(--luma-trigger-size);
                border-radius: 50%;
                background: linear-gradient(135deg, var(--luma-primary) 0%, var(--luma-secondary) 100%);
                box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                border: none;
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                position: relative;
                padding: 0;
            }

            .luma-trigger:hover {
                transform: scale(1.1);
            }

            .luma-trigger:active {
                transform: scale(0.95);
            }

            .luma-trigger-icon {
                width: 32px;
                height: 32px;
                color: white;
                animation: luma-float 4s ease-in-out infinite;
            }

            @keyframes luma-float {
                0%, 100% { transform: translateY(0) rotate(0); }
                50% { transform: translateY(-4px) rotate(5deg); }
            }

            .luma-notification-dot {
                position: absolute;
                top: 4px;
                right: 4px;
                width: 14px;
                height: 14px;
                background-color: #ef4444;
                border: 2px solid white;
                border-radius: 50%;
                display: none;
            }

            /* --- Chat Bubble (Globito) --- */
            .luma-bubble {
                position: absolute;
                bottom: 80px;
                right: 0;
                width: 240px;
                background: white;
                padding: 12px 16px;
                border-radius: 16px;
                box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
                border: 1px solid #e5e7eb;
                font-size: 13px;
                line-height: 1.4;
                color: #374151;
                opacity: 0;
                transform: translateX(20px) scale(0.8);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                pointer-events: none;
            }

            .luma-bubble.show {
                opacity: 1;
                transform: translateX(0) scale(1);
            }

            .luma-bubble-label {
                font-weight: 600;
                color: #6366f1;
                margin-bottom: 4px;
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            .luma-bubble-caret {
                position: absolute;
                bottom: -6px;
                right: 24px;
                width: 12px;
                height: 12px;
                background-color: white;
                transform: rotate(45deg);
                border-right: 1px solid #e5e7eb;
                border-bottom: 1px solid #e5e7eb;
            }

            /* --- Chat Window --- */
            .luma-chat {
                position: absolute;
                bottom: 95px;
                right: 0px;
                width: var(--luma-chat-width);
                height: var(--luma-chat-height);
                background: var(--luma-surface);
                border-radius: 24px;
                box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                border: 1px solid #f3f4f6;
                opacity: 0;
                transform: translateY(20px) scale(0.95);
                transform-origin: bottom right;
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                pointer-events: none;
                visibility: hidden;
                z-index: 1;
            }

            .luma-chat.open {
                opacity: 1;
                transform: translateY(0) scale(1);
                pointer-events: auto;
                visibility: visible;
            }

            .luma-chat-header {
                padding: 16px;
                background: linear-gradient(135deg, var(--luma-primary), var(--luma-secondary));
                color: white;
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-shrink: 0;
                gap: 10px;
            }

            .luma-chat-header-info {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .luma-chat-header-logo {
                width: 40px;
                height: 40px;
                border-radius: 10px;
                background: rgba(255, 255, 255, 0.2);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .luma-chat-header-title {
                margin: 0;
                font-size: 14px;
                font-weight: bold;
                line-height: 1.2;
            }

            .luma-chat-header-status {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 10px;
                color: #e0e7ff;
                font-weight: 500;
                text-transform: uppercase;
                margin-top: 2px;
            }

            .luma-status-dot {
                width: 6px;
                height: 6px;
                background-color: #4ade80;
                border-radius: 50%;
            }

            .luma-close-btn {
                background: none;
                border: none;
                cursor: pointer;
                padding: 8px;
                color: white;
                opacity: 0.8;
                transition: opacity 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .luma-close-btn:hover {
                opacity: 1;
            }

            .luma-chat-header-actions {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .luma-header-select {
                appearance: none;
                border: 1px solid rgba(255, 255, 255, 0.3);
                background: rgba(255, 255, 255, 0.14);
                color: #ffffff;
                border-radius: 8px;
                height: 30px;
                padding: 0 10px;
                font-size: 11px;
                font-weight: 600;
                outline: none;
                cursor: pointer;
            }

            .luma-header-select option {
                color: #111827;
                background: #ffffff;
            }

            .luma-chat.luma-theme-dark {
                background: #0b1222;
                border-color: #1f2a44;
            }

            .luma-chat.luma-theme-dark .luma-messages {
                background: #0f172a;
            }

            .luma-chat.luma-theme-dark .luma-msg-row.bot .luma-msg-bubble {
                background: #111b31;
                color: #e5e7eb;
                border-color: #28354f;
            }

            .luma-chat.luma-theme-dark .luma-msg-avatar {
                background: #162038;
                border-color: #27344d;
            }

            .luma-chat.luma-theme-dark .luma-suggestions,
            .luma-chat.luma-theme-dark .luma-input-area,
            .luma-chat.luma-theme-dark .luma-footer {
                background: #0b1222;
                border-color: #1f2a44;
            }

            .luma-chat.luma-theme-dark .luma-input {
                background: #111b31;
                color: #e5e7eb;
            }

            .luma-chat.luma-theme-dark .luma-input::placeholder {
                color: #94a3b8;
            }

            .luma-chat.luma-theme-dark .luma-chip {
                background: #111b31;
                border-color: #2e3a57;
                color: #c7d2fe;
            }

            /* --- Messages --- */
            .luma-messages {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
                background-color: #f9fafb;
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            .luma-msg-row {
                display: flex;
                width: 100%;
            }

            .luma-msg-row.user { justify-content: flex-end; }
            .luma-msg-row.bot { justify-content: flex-start; }

            .luma-msg-wrapper {
                display: flex;
                gap: 8px;
                max-width: 85%;
                flex-direction: column; /* Allow buttons to wrap naturally below */
            }
            .luma-msg-wrapper-top {
                display: flex;
                gap: 8px;
            }

            .luma-msg-row.user .luma-msg-wrapper-top { flex-direction: row-reverse; }
            .luma-msg-row.user .luma-msg-wrapper { align-items: flex-end; } /* Reset for internal row flex */

            .luma-msg-avatar {
                width: 32px;
                height: 32px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                background: white;
                border: 1px solid #f3f4f6;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            }

            .luma-msg-row.user .luma-msg-avatar {
                background: #e0e7ff;
                border: none;
            }

            .luma-msg-bubble {
                padding: 12px;
                border-radius: 16px;
                font-size: 14px;
                line-height: 1.5;
                word-wrap: break-word;
            }

            .luma-msg-row.bot .luma-msg-bubble {
                background: white;
                color: #1f2937;
                border: 1px solid #f3f4f6;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                border-top-left-radius: 4px;
            }

            .luma-msg-row.user .luma-msg-bubble {
                background: var(--luma-primary);
                color: white;
                border-top-right-radius: 4px;
            }

            .luma-typing-dots {
                display: inline-flex;
                gap: 4px;
                align-items: center;
            }

            .luma-typing-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #a78bfa;
                animation: luma-typing 1.1s infinite ease-in-out;
            }

            .luma-typing-dot:nth-child(2) { animation-delay: 0.15s; }
            .luma-typing-dot:nth-child(3) { animation-delay: 0.3s; }

            @keyframes luma-typing {
                0%, 80%, 100% { opacity: 0.35; transform: translateY(0); }
                40% { opacity: 1; transform: translateY(-2px); }
            }

            /* --- Suggested Actions --- */
            .luma-suggestions {
                padding: 0 16px 16px 56px;
                display: flex;
                gap: 8px;
                background-color: #f9fafb;
                overflow-x: auto;
                scroll-snap-type: x mandatory;
                -webkit-overflow-scrolling: touch;
                scrollbar-width: none; /* Firefox */
            }
            .luma-suggestions::-webkit-scrollbar { 
                display: none; 
            }

            .luma-chip {
                background: white;
                border: 1px solid #e0e7ff;
                color: #4f46e5;
                padding: 8px 16px;
                border-radius: 9999px;
                font-size: 12px;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                transition: all 0.2s;
                font-family: inherit;
                scroll-snap-align: start;
                flex-shrink: 0;
            }

            .luma-chip:hover {
                background: #f5f3ff;
                border-color: #c4b5fd;
            }

            /* --- Input Area --- */
            .luma-input-area {
                padding: 16px;
                background: white;
                border-top: 1px solid #f3f4f6;
                display: flex;
                gap: 8px;
                flex-shrink: 0;
            }

            .luma-input {
                flex: 1;
                background: #f9fafb;
                border: none;
                border-radius: 16px;
                padding: 12px 16px;
                font-size: 14px;
                outline: none;
                font-family: inherit;
            }

            .luma-send-btn {
                width: 40px;
                height: 40px;
                border-radius: 12px;
                background: var(--luma-primary);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                border: none;
                cursor: pointer;
                transition: opacity 0.2s, transform 0.2s;
            }

            .luma-send-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .luma-send-btn:not(:disabled):hover {
                transform: scale(1.05);
            }

            .luma-footer {
                padding-bottom: 8px;
                text-align: center;
                font-size: 10px;
                color: #9ca3af;
                background: white;
            }

            .luma-footer b { color: var(--luma-primary); }

            .luma-assistant-container.pos-bottom-left {
                right: auto;
                left: 24px;
                align-items: flex-start;
            }
            .luma-assistant-container.pos-bottom-left .luma-chat {
                right: auto;
                left: 0;
                transform-origin: bottom left;
            }

            .luma-chat.template-compact {
                --luma-chat-width: 344px;
                --luma-chat-height: 470px;
            }
            .luma-chat.template-minimal {
                --luma-chat-width: 320px;
                --luma-chat-height: 440px;
            }

            /* --- Walkthrough Progress Panel --- */
            .luma-progress-panel {
                display: none;
                border-bottom: 1px solid #ede9fe;
                background: #faf5ff;
                padding: 10px 14px;
                flex-shrink: 0;
            }
            .luma-progress-panel.visible { display: block; }
            .luma-progress-title {
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                color: #7c3aed;
                margin-bottom: 8px;
            }
            .luma-progress-steps { display: flex; flex-direction: column; gap: 3px; }
            .luma-step-row {
                display: flex;
                align-items: flex-start;
                gap: 7px;
                font-size: 12px;
                line-height: 1.4;
                color: #6b7280;
                padding: 2px 0;
            }
            .luma-step-row.active { color: #4f46e5; font-weight: 600; }
            .luma-step-row.done { color: #16a34a; }
            .luma-step-icon { font-size: 13px; flex-shrink: 0; width: 16px; margin-top: 1px; }
            .luma-progress-done-banner {
                font-size: 12px; font-weight: 600; color: #16a34a;
                background: #dcfce7; border-radius: 6px; padding: 6px 10px; text-align: center;
            }
        `;
        this.shadowRoot.appendChild(style);
    }

    private createTriggerButton() {
        this.triggerButton = document.createElement("button");
        this.triggerButton.className = "luma-trigger";
        this.triggerButton.innerHTML = `
            <div class="luma-trigger-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12c0-2.316.784-4.448 2.1-6.142L2 2h4.142A10 10 0 0 1 12 2z"></path>
                    <path d="M8 12h.01"></path>
                    <path d="M12 12h.01"></path>
                    <path d="M16 12h.01"></path>
                </svg>
            </div>
            <div class="luma-notification-dot"></div>
            <div class="luma-bubble">
                <div class="luma-bubble-label">${this.escapeHtml(this.strings.guideLabel)}</div>
                <div class="luma-bubble-content"></div>
                <div class="luma-bubble-caret"></div>
            </div>
        `;

        this.triggerButton.onclick = () => {
            if (this.isOpen) {
                this.close();
            } else {
                this.open();
                this.hideBubble();
            }
        };

        this.container.appendChild(this.triggerButton);
    }

    private createChatWindow(initialMessages?: ChatMessage[]) {
        this.chatWindow = document.createElement("div");
        this.chatWindow.className = "luma-chat";
        this.chatWindow.innerHTML = `
            <div class="luma-chat-header">
                <div class="luma-chat-header-info">
                    <div class="luma-chat-header-logo">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5">
                            <rect x="3" y="7" width="18" height="12" rx="3" fill="rgba(255,255,255,0.2)" />
                            <circle cx="8" cy="13" r="1" fill="white" />
                            <circle cx="16" cy="13" r="1" fill="white" />
                            <path d="M10 16s.5 1 2 1 2-1 2-1" stroke="white" />
                        </svg>
                    </div>
                    <div>
                        <div class="luma-chat-header-title">Luma Assistant</div>
                        <div class="luma-chat-header-status">
                            <div class="luma-status-dot"></div>
                            <span class="luma-chat-header-status-text">${this.escapeHtml(this.strings.online)}</span>
                        </div>
                    </div>
                </div>
                <div class="luma-chat-header-actions">
                    <select class="luma-header-select luma-theme-select" aria-label="Theme">
                        <option value="light">${this.escapeHtml(this.strings.themeLight)}</option>
                        <option value="dark">${this.escapeHtml(this.strings.themeDark)}</option>
                    </select>
                    <select class="luma-header-select luma-lang-select" aria-label="Language">
                        <option value="es">${this.escapeHtml(this.strings.langEs)}</option>
                        <option value="en">${this.escapeHtml(this.strings.langEn)}</option>
                    </select>
                    <button class="luma-close-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            </div>
            <div class="luma-progress-panel"></div>
            <div class="luma-messages"></div>
            <div class="luma-suggestions"></div>
            <form class="luma-input-area">
                <input class="luma-input" placeholder="${this.escapeHtml(this.strings.inputPlaceholder)}" spellcheck="false" />
                <button type="submit" class="luma-send-btn" disabled>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
            </form>
            <div class="luma-footer">${this.escapeHtml(this.strings.footerPoweredBy)} <b>LumaWay</b></div>
        `;

        this.messagesList = this.chatWindow.querySelector(".luma-messages")!;
        this.progressPanel = this.chatWindow.querySelector(".luma-progress-panel")!;
        this.input = this.chatWindow.querySelector(".luma-input")!;
        const sendBtn = this.chatWindow.querySelector(".luma-send-btn") as HTMLButtonElement;
        const form = this.chatWindow.querySelector(".luma-input-area") as HTMLFormElement;
        const closeBtn = this.chatWindow.querySelector(".luma-close-btn") as HTMLButtonElement;
        const langSelect = this.chatWindow.querySelector(".luma-lang-select") as HTMLSelectElement;
        const themeSelect = this.chatWindow.querySelector(".luma-theme-select") as HTMLSelectElement;

        // Restore conversation history so it survives SDK/Assistant re-creation
        if (initialMessages && initialMessages.length > 0) {
            initialMessages.forEach((msg) => this.addMessage(msg.role, msg.text, msg.actions, true));
        }

        closeBtn.onclick = () => this.close();
        this.applyThemeClass();
        langSelect.value = this.locale.startsWith("es") ? "es" : "en";
        themeSelect.value = this.theme;

        langSelect.onchange = () => {
            const locale = langSelect.value === "es" ? "es" : "en";
            this.onLocaleChange?.(locale);
        };
        themeSelect.onchange = () => {
            const next = themeSelect.value === "dark" ? "dark" : "light";
            this.setTheme(next);
            this.onThemeChange?.(next);
        };

        this.input.oninput = () => {
            sendBtn.disabled = !this.input.value.trim();
        };

        form.onsubmit = (e) => {
            e.preventDefault();
            const text = this.input.value.trim();
            if (text) {
                this.addMessage("user", text);
                this.input.value = "";
                sendBtn.disabled = true;
                this.onTrackIntent(text);
            }
        };

        this.container.appendChild(this.chatWindow);
    }

    public addMessage(
        role: "user" | "bot",
        text: string,
        actions?: Array<{ label: string; action?: string; walkthroughId?: string; stepId?: string }>,
        skipPersist?: boolean,
        routeBadge?: string
    ) {
        if (role === "bot") {
            this.setTyping(false);
        }

        const row = document.createElement("div");
        row.className = `luma-msg-row ${role}`;

        const isUser = role === "user";
        const icon = isUser ? `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        ` : `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9333ea" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></svg>
        `;

        // Render markdown for bot messages
        const content = role === "bot" ? this.renderMarkdown(text) : this.escapeHtml(text);

        row.innerHTML = `
            <div class="luma-msg-wrapper">
                <div class="luma-msg-wrapper-top">
                    <div class="luma-msg-avatar">${icon}</div>
                    <div class="luma-msg-bubble">${content}</div>
                </div>
            </div>
        `;

        // Add action buttons for bot messages right under the text, offset by avatar
        if (role === "bot" && actions && actions.length > 0) {
            const actionsContainer = document.createElement("div");
            actionsContainer.className = "luma-msg-actions";
            actionsContainer.style.cssText = "display: flex; gap: 8px; margin-top: 8px; margin-left: 40px; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 4px; scrollbar-width: none;";

            actions.forEach(action => {
                const btn = document.createElement("button");
                btn.className = "luma-action-btn";
                // Include play icon
                btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px; vertical-align: middle;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> ${action.label}`;
                btn.style.cssText = "padding: 6px 12px; background: white; color: #4f46e5; border: 1px solid #e0e7ff; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.05); display: flex; align-items: center; scroll-snap-align: start; flex-shrink: 0;";
                btn.onmouseover = () => { btn.style.background = "#f5f3ff"; btn.style.borderColor = "#c4b5fd"; };
                btn.onmouseout = () => { btn.style.background = "white"; btn.style.borderColor = "#e0e7ff"; };
                btn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    if (btn.style.opacity === "0.7") return; // Prevent double clicks
                    btn.style.opacity = "0.7";
                    btn.disabled = true;

                    if (action.walkthroughId) {
                        // Close chat immediately before starting walkthrough
                        // so that the render() call from the engine doesn't re-open it
                        this.close();
                        this.onAdvanceStep(action.walkthroughId, action.stepId || '');
                    } else if (action.action) {
                        const siblings = Array.from(actionsContainer.querySelectorAll("button")) as HTMLButtonElement[];
                        siblings.forEach((b) => {
                            b.disabled = true;
                            b.style.opacity = "0.55";
                            b.style.pointerEvents = "none";
                        });
                        // Keep chat open for command actions (assist/browser run)
                        // so user can see execution feedback in real time.
                        this.onTrackIntent(action.action);
                    }
                };
                actionsContainer.appendChild(btn);
            });

            const wrapper = row.querySelector(".luma-msg-wrapper");
            if (wrapper) {
                wrapper.appendChild(actionsContainer);
            }
        }

        this.messagesList.appendChild(row);

        // Route badge pill — shown below the bubble for guided steps
        if (routeBadge && role === "bot") {
            const badge = document.createElement("div");
            badge.style.cssText = `
                display: flex; align-items: center; gap: 4px;
                margin-top: 4px; margin-left: 40px;
                font-size: 10px; font-weight: 600;
                color: #6d28d9; font-family: 'Inter', monospace;
                opacity: 0.75;
            `;
            badge.innerHTML = `
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
                <span>${routeBadge}</span>
            `;
            this.messagesList.appendChild(badge);
        }

        this.messagesList.scrollTop = this.messagesList.scrollHeight;

        if (!skipPersist && this.onMessageAdded) {
            this.onMessageAdded({ role, text, actions });
        }
    }

    public setTyping(isTyping: boolean) {
        if (isTyping) {
            if (this.typingRow) {
                return;
            }
            const row = document.createElement("div");
            row.className = "luma-msg-row bot";
            row.innerHTML = `
                <div class="luma-msg-wrapper">
                    <div class="luma-msg-wrapper-top">
                        <div class="luma-msg-avatar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9333ea" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path></svg>
                        </div>
                        <div class="luma-msg-bubble">
                            <span class="luma-typing-dots">
                                <span class="luma-typing-dot"></span>
                                <span class="luma-typing-dot"></span>
                                <span class="luma-typing-dot"></span>
                            </span>
                        </div>
                    </div>
                </div>
            `;
            this.typingRow = row;
            this.messagesList.appendChild(row);
            this.messagesList.scrollTop = this.messagesList.scrollHeight;
            return;
        }

        if (this.typingRow) {
            this.typingRow.remove();
            this.typingRow = null;
        }
    }

    public setStreamingBotMessage(text: string) {
        this.setTyping(false);
        if (!this.streamingRow || !this.streamingBubble) {
            const row = document.createElement("div");
            row.className = "luma-msg-row bot";
            row.innerHTML = `
                <div class="luma-msg-wrapper">
                    <div class="luma-msg-wrapper-top">
                        <div class="luma-msg-avatar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9333ea" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path></svg>
                        </div>
                        <div class="luma-msg-bubble"></div>
                    </div>
                </div>
            `;
            this.streamingRow = row;
            this.streamingBubble = row.querySelector(".luma-msg-bubble") as HTMLElement | null;
            this.messagesList.appendChild(row);
        }

        if (this.streamingBubble) {
            this.streamingBubble.innerHTML = this.renderMarkdown(text);
        }
        this.messagesList.scrollTop = this.messagesList.scrollHeight;
    }

    public clearStreamingBotMessage() {
        if (this.streamingRow) {
            this.streamingRow.remove();
            this.streamingRow = null;
            this.streamingBubble = null;
        }
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    private sanitizeAssistantText(text: string): string {
        if (!text) return '';
        let clean = text;
        clean = clean.replace(/\[\s*(target|selector|dom|elemento)\s*:\s*#[^\]]+\]/gi, '');
        clean = clean.replace(/\b(target|selector|dom|elemento)\s*:\s*#[a-z0-9\-_:.]+/gi, '');
        clean = clean.replace(/\(\s*#[a-z0-9\-_:.]+\s*\)/gi, '');
        clean = clean.replace(/[ \t]{2,}/g, ' ');
        clean = clean.replace(/\n{3,}/g, '\n\n');
        return clean.trim();
    }

    private renderMarkdown(text: string): string {
        let html = this.escapeHtml(this.sanitizeAssistantText(text));

        // Headers (##, ###)
        html = html.replace(/^### (.+)$/gm, '<h4 style="margin: 8px 0; font-size: 14px; font-weight: 600;">$1</h4>');
        html = html.replace(/^## (.+)$/gm, '<h3 style="margin: 10px 0; font-size: 16px; font-weight: 600;">$1</h3>');

        // Bold **text**
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Italic *text*
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

        // Code `code`
        html = html.replace(/`(.+?)`/g, '<code style="background: #f3f4f6; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 13px;">$1</code>');

        // Links [text](url) -> plain text (no clickable HTML elements in assistant output)
        html = html.replace(/\[(.+?)\]\((.+?)\)/g, '$1 ($2)');

        // Unordered lists
        html = html.replace(/^\- (.+)$/gm, '<li style="margin-left: 20px;">$1</li>');
        html = html.replace(/(<li.*<\/li>)/s, '<ul style="margin: 8px 0; padding-left: 0;">$1</ul>');

        // Line breaks
        html = html.replace(/\n/g, '<br>');

        return html;
    }

    private clearSuggestions() {
        const container = this.chatWindow.querySelector(".luma-suggestions")!;
        container.innerHTML = "";
    }

    private addSuggestion(title: string, walkthroughId?: string, stepId?: string) {
        // Avoid non-actionable chips ("Ver opciones") that cause intent loops.
        if (!walkthroughId) return;

        const container = this.chatWindow.querySelector(".luma-suggestions")!;
        const chip = document.createElement("button");
        chip.className = "luma-chip";
        chip.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
            ${title}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        `;

        chip.onclick = (e) => {
            e.stopPropagation();
            chip.style.opacity = "0.7";

            // Close immediately so engine render() can't race-reopen the chat
            this.close();

            this.onAdvanceStep(walkthroughId, stepId || '');
        };

        container.appendChild(chip);
    }

    /**
     * Set suggestions/chips globally for the footer based on actions
     */
    public setChatSuggestions(actions: Array<{ label: string; action?: string; walkthroughId?: string; stepId?: string }>) {
        this.contextualSuggestions = (actions || []).filter((a) => Boolean(a.walkthroughId));
        this.clearSuggestions();
        this.contextualSuggestions.forEach(action => {
            this.addSuggestion(action.label, action.walkthroughId, action.stepId);
        });
    }

    public open() {
        if (this.lockClosedForAutomation) return;
        this.isOpen = true;
        this.chatWindow.classList.add("open");

        // this.triggerButton.style.transform = "scale(0)"; // Removed to keep button visible
        this.hideBubble(); // Ensure bubble is hidden
        setTimeout(() => {
            this.input.focus();
        }, 300);
    }

    public close() {
        this.isOpen = false;
        this.chatWindow.classList.remove("open");

        this.triggerButton.style.transform = "scale(1)";
    }

    public setAutomationChatLock(locked: boolean) {
        this.lockClosedForAutomation = locked;
        if (locked) {
            this.close();
        }
    }

    /**
     * Short message for the trigger bubble in guided mode. Must NOT duplicate the tooltip.
     * Supports Luma as helper or references the step intention briefly.
     */
    private getGuidedBubbleMessage(plan: GuidancePlan): string {
        const action = plan.suggestedAction || (plan.possibleActions?.[0]?.title);
        if (action && action.length <= 40) {
            return `${this.strings.guidedBubblePrefix} ${action}`;
        }
        if (action && action.length > 40) {
            return this.strings.guidedBubbleShort;
        }
        return this.strings.guidedBubbleGeneric;
    }

    /** Duration in ms before the bubble auto-hides (short so it doesn't compete with the tooltip). */
    private static readonly BUBBLE_AUTO_HIDE_MS = 3500;

    /**
     * Show a short message on the trigger button bubble when chat is closed.
     * Used in guided mode: do NOT duplicate the tooltip text. Show a brief helper line instead.
     */
    public showBubbleMessage(shortMessage: string) {
        if (this.isOpen) return; // Never show bubble if chat is open

        const bubble = this.triggerButton.querySelector(".luma-bubble")!;
        const content = bubble.querySelector(".luma-bubble-content")!;
        content.textContent = shortMessage;
        bubble.classList.add("show");
        setTimeout(() => this.hideBubble(), Assistant.BUBBLE_AUTO_HIDE_MS);
    }

    public hideBubble() {
        const bubble = this.triggerButton.querySelector(".luma-bubble")!;
        bubble.classList.remove("show");
    }

    public notifyUnread(shortMessage?: string) {
        const dot = this.triggerButton.querySelector(".luma-notification-dot") as HTMLElement | null;
        if (dot) {
            dot.style.display = "block";
        }
        if (shortMessage && !this.isOpen) {
            this.showBubbleMessage(shortMessage);
        }
    }

    public updateWalkthroughProgress(
        walkthroughName: string | null,
        steps: Array<{ id: string; title: string }>,
        completedStepIds: string[],
        activeStepId: string | null,
        isComplete: boolean
    ) {
        if (!walkthroughName || steps.length === 0) {
            this.progressPanel.classList.remove('visible');
            this.progressPanel.innerHTML = '';
            return;
        }

        this.progressPanel.classList.add('visible');

        if (isComplete) {
            this.progressPanel.innerHTML = `
                <div class="luma-progress-title">🗺️ ${walkthroughName}</div>
                <div class="luma-progress-done-banner">${this.escapeHtml(this.strings.walkthroughCompleted)}</div>
            `;
            return;
        }

        const stepsHtml = steps.map((step) => {
            const done = completedStepIds.includes(step.id);
            const active = step.id === activeStepId && !done;
            const cls = done ? 'done' : active ? 'active' : '';
            const icon = done ? '✅' : active ? '🔵' : '⭕';
            return `<div class="luma-step-row ${cls}">
                <span class="luma-step-icon">${icon}</span>
                <span>${step.title || step.id}</span>
            </div>`;
        }).join('');

        this.progressPanel.innerHTML = `
            <div class="luma-progress-title">🗺️ ${walkthroughName}</div>
            <div class="luma-progress-steps">${stepsHtml}</div>
        `;
    }

    public render(plan: GuidancePlan | null) {
        if (!plan) return;
        if (this.lockClosedForAutomation) {
            this.hideBubble();
            return;
        }

        // 0. Update Assistant Name
        if (plan && plan.config) {
            const titleEl = this.chatWindow.querySelector(".luma-chat-header-title");
            if (titleEl) {
                const name = plan.config.settings?.assistantName || plan.config.name || "Luma Assistant";
                titleEl.textContent = name;
            }
            this.setUiSettings((plan.config.settings as any)?.chatbotUi || {});
        }

        // 1. Welcome Message — show only when chat has no messages yet
        if (!plan.message && plan.config?.settings?.assistantWelcomeMessage) {
            const visibleMessages = this.messagesList.querySelectorAll('.luma-msg-row').length;
            if (visibleMessages === 0) {
                this.addMessage("bot", plan.config.settings.assistantWelcomeMessage);
            }
            return;
        }

        if (!plan.message) return;

        const isUniversal = !plan.metadata?.targetSelector;
        const stepId = plan.metadata?.stepId;
        const walkthroughId = plan.metadata?.walkthroughId;
        const isNewStep = stepId !== this.lastStepId;

        const lastMsg = this.messagesList.lastElementChild?.querySelector(".luma-msg-bubble")?.textContent;

        if (lastMsg !== plan.message) {
            // Chat shows universal messages only.
            // Guided steps are navigated through the Tooltip. Start/completion messages
            // are injected by LumaSDK.handleWalkthroughCompleted.
            if (isUniversal) {
                this.addMessage("bot", plan.message);
                if (!this.isOpen) {
                    const dot = this.triggerButton.querySelector(".luma-notification-dot") as HTMLElement;
                    dot.style.display = "block";
                }
            }
        }

        // 3. Footer Suggestions — hide completely during a guided walkthrough
        this.clearSuggestions();
        if (walkthroughId && stepId) return; // tooltip is active — no footer chips needed

        const hasPlanActions = !!(plan.possibleActions && plan.possibleActions.length > 0);
        if (hasPlanActions) {
            plan.possibleActions!.forEach((action: any) => {
                if (!action.walkthroughId) return;
                this.addSuggestion(
                    action.title,
                    action.walkthroughId,
                    action.stepId
                );
            });
        } else if (plan.suggestedAction && walkthroughId) {
            this.addSuggestion(
                plan.suggestedAction,
                walkthroughId,
                stepId
            );
        } else if (this.contextualSuggestions.length > 0) {
            this.contextualSuggestions.forEach((action) => {
                this.addSuggestion(action.label, action.walkthroughId, action.stepId);
            });
        }

        // 4. Mode Switching & Auto-Behavior
        // Keep chat open so the user always sees AI messages. Tooltip and bubble support the flow without hiding the conversation.
        const isNextFlow = plan.metadata?.isNextFlow === true;

        if (isNewStep) {
            if (!isUniversal && !isNextFlow) {
                // GUIDED MODE: Tooltip shows on the element. Do NOT close the chat so the user can read the AI reply.
                // Only show the short bubble on the trigger when the chat is already closed (reminder that Luma is guiding).
                if (!this.isOpen) {
                    const bubbleShortMessage = this.getGuidedBubbleMessage(plan);
                    this.showBubbleMessage(bubbleShortMessage);
                } else {
                    this.hideBubble();
                }
            } else {
                // CONVERSATIONAL MODE or NEXT FLOW: Chat takes center stage.
                if (isNextFlow && !this.isOpen) {
                    this.open();
                } else if (!isNextFlow) {
                    this.open();
                }
                this.hideBubble();
            }
            this.lastStepId = stepId || 'universal';
        }
    }

    public setStrings(strings: SdkI18nStrings) {
        this.strings = strings;
        const bubbleLabel = this.triggerButton?.querySelector(".luma-bubble-label");
        if (bubbleLabel) bubbleLabel.textContent = strings.guideLabel;
        const statusText = this.chatWindow?.querySelector(".luma-chat-header-status-text");
        if (statusText) statusText.textContent = strings.online;
        if (this.input) this.input.placeholder = strings.inputPlaceholder;
        const langSelect = this.chatWindow?.querySelector(".luma-lang-select") as HTMLSelectElement | null;
        if (langSelect) langSelect.value = this.locale.startsWith("es") ? "es" : "en";
        const themeSelect = this.chatWindow?.querySelector(".luma-theme-select") as HTMLSelectElement | null;
        if (themeSelect) {
            const lightOpt = themeSelect.querySelector('option[value="light"]');
            const darkOpt = themeSelect.querySelector('option[value="dark"]');
            if (lightOpt) lightOpt.textContent = strings.themeLight;
            if (darkOpt) darkOpt.textContent = strings.themeDark;
        }
        if (langSelect) {
            const esOpt = langSelect.querySelector('option[value="es"]');
            const enOpt = langSelect.querySelector('option[value="en"]');
            if (esOpt) esOpt.textContent = strings.langEs;
            if (enOpt) enOpt.textContent = strings.langEn;
        }
        const footer = this.chatWindow?.querySelector(".luma-footer");
        if (footer) footer.innerHTML = `${this.escapeHtml(strings.footerPoweredBy)} <b>LumaWay</b>`;
    }

    public setLocale(locale: string) {
        this.locale = (locale || "en").toLowerCase();
        this.setStrings(resolveSdkStrings(this.locale));
    }

    public setTheme(theme: "light" | "dark") {
        this.theme = theme;
        this.applyThemeClass();
        const themeSelect = this.chatWindow?.querySelector(".luma-theme-select") as HTMLSelectElement | null;
        if (themeSelect) themeSelect.value = theme;
    }

    public setUiSettings(settings: ChatbotUiSettings) {
        this.uiSettings = { ...this.uiSettings, ...(settings || {}) };
        this.applyUiSettings(this.uiSettings);
    }

    private applyThemeClass() {
        if (!this.chatWindow) return;
        this.chatWindow.classList.remove("luma-theme-light", "luma-theme-dark");
        this.chatWindow.classList.add(this.theme === "dark" ? "luma-theme-dark" : "luma-theme-light");
    }

    private applyUiSettings(settings: ChatbotUiSettings) {
        if (!this.container || !this.chatWindow) return;

        const position = settings.position || "bottom-right";
        this.container.classList.remove("pos-bottom-left");
        if (position === "bottom-left") this.container.classList.add("pos-bottom-left");

        const template = settings.template || "default";
        this.chatWindow.classList.remove("template-compact", "template-minimal");
        if (template === "compact") this.chatWindow.classList.add("template-compact");
        if (template === "minimal") this.chatWindow.classList.add("template-minimal");

        const root = this.container;
        const primary = this.sanitizeColor(settings.primaryColor);
        const secondary = this.sanitizeColor(settings.secondaryColor);
        const surface = this.sanitizeColor(settings.surfaceColor);
        if (primary) root.style.setProperty("--luma-primary", primary);
        if (secondary) root.style.setProperty("--luma-secondary", secondary);
        if (surface) root.style.setProperty("--luma-surface", surface);

        if (typeof settings.chatWidth === "number" && settings.chatWidth >= 300 && settings.chatWidth <= 560) {
            root.style.setProperty("--luma-chat-width", `${settings.chatWidth}px`);
        }
        if (typeof settings.chatHeight === "number" && settings.chatHeight >= 420 && settings.chatHeight <= 760) {
            root.style.setProperty("--luma-chat-height", `${settings.chatHeight}px`);
        }
        if (typeof settings.triggerSize === "number" && settings.triggerSize >= 48 && settings.triggerSize <= 88) {
            root.style.setProperty("--luma-trigger-size", `${settings.triggerSize}px`);
        }
    }

    private sanitizeColor(color?: string): string | null {
        const raw = String(color || "").trim();
        if (!raw) return null;
        if (/^#[0-9a-fA-F]{3,8}$/.test(raw)) return raw;
        if (/^rgb(a?)\(.+\)$/.test(raw)) return raw;
        return null;
    }
}
