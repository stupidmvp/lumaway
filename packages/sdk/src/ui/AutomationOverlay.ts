import type { SdkI18nStrings } from "../i18n.js";
import { resolveSdkStrings } from "../i18n.js";

export interface AutomationOverlayOptions {
    onPause: () => void;
    onResume: () => void;
    onStop: () => void;
    onAuthorize: () => void;
    locale?: string;
}

export class AutomationOverlay {
    private options: AutomationOverlayOptions;
    private host: HTMLElement;
    private shadowRoot: ShadowRoot;
    private container: HTMLElement;
    private statusEl: HTMLElement;
    private progressEl: HTMLElement;
    private pauseResumeBtn: HTMLButtonElement;
    private stopBtn: HTMLButtonElement;
    private authorizeBtn: HTMLButtonElement;
    private visible = false;
    private paused = false;
    private strings: SdkI18nStrings;

    constructor(options: AutomationOverlayOptions) {
        this.options = options;
        this.strings = resolveSdkStrings(options.locale);
        const existing = document.getElementById("luma-automation-overlay-host");
        if (existing) existing.remove();

        this.host = document.createElement("div");
        this.host.id = "luma-automation-overlay-host";
        document.body.appendChild(this.host);
        this.shadowRoot = this.host.attachShadow({ mode: "open" });

        const style = document.createElement("style");
        style.textContent = `
            :host { all: initial; }
            .luma-auto-overlay {
                position: fixed;
                inset: 0;
                z-index: 2147483646;
                display: none;
                align-items: flex-end;
                justify-content: center;
                pointer-events: auto;
                opacity: 0;
                transition: opacity 180ms ease;
            }
            .luma-auto-vignette {
                position: absolute;
                inset: 0;
                pointer-events: none;
                backdrop-filter: blur(0.9px) saturate(1.01);
                background:
                    linear-gradient(to right,
                        rgba(56, 189, 248, 0.12) 0%,
                        rgba(56, 189, 248, 0.085) 8%,
                        rgba(56, 189, 248, 0.0) 20%,
                        rgba(56, 189, 248, 0.0) 80%,
                        rgba(56, 189, 248, 0.085) 92%,
                        rgba(56, 189, 248, 0.12) 100%),
                    radial-gradient(34% 30% at 0% 0%, rgba(59, 130, 246, 0.09), rgba(59, 130, 246, 0) 78%),
                    radial-gradient(34% 30% at 100% 0%, rgba(59, 130, 246, 0.09), rgba(59, 130, 246, 0) 78%),
                    radial-gradient(34% 30% at 0% 100%, rgba(59, 130, 246, 0.08), rgba(59, 130, 246, 0) 78%),
                    radial-gradient(34% 30% at 100% 100%, rgba(59, 130, 246, 0.08), rgba(59, 130, 246, 0) 78%);
                -webkit-mask-image: linear-gradient(to right, #000 0%, #000 16%, transparent 40%, transparent 60%, #000 84%, #000 100%);
                mask-image: linear-gradient(to right, #000 0%, #000 16%, transparent 40%, transparent 60%, #000 84%, #000 100%);
                animation: luma-edge-breathe 3.2s ease-in-out infinite;
            }
            .luma-auto-blocker {
                position: absolute;
                inset: 0;
                /* Transparent blocker to prevent manual interaction on the host app */
                background: rgba(2, 6, 23, 0.01);
                pointer-events: auto;
                cursor: wait;
            }
            .luma-auto-toolbar {
                position: relative;
                margin-bottom: 16px;
                width: min(680px, calc(100vw - 30px));
                min-height: 40px;
                background: rgba(15, 23, 42, 0.66);
                border: 1px solid rgba(255, 255, 255, 0.14);
                border-radius: 999px;
                box-shadow:
                    0 12px 28px rgba(2, 6, 23, 0.26),
                    0 1px 0 rgba(255, 255, 255, 0.08) inset;
                padding: 6px 10px;
                font-family: Inter, system-ui, -apple-system, sans-serif;
                color: #f8fafc;
                display: flex;
                align-items: center;
                gap: 10px;
                pointer-events: auto;
                opacity: 0;
                transform: translateY(-8px) scale(0.992);
                transition: opacity 200ms ease, transform 200ms ease;
                backdrop-filter: blur(10px) saturate(1.04);
            }
            .luma-auto-dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: #22c55e;
                box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.16);
                flex-shrink: 0;
            }
            .luma-auto-main {
                display: flex;
                align-items: baseline;
                gap: 8px;
                min-width: 0;
                flex: 1;
            }
            .luma-auto-status {
                font-size: 11px;
                font-weight: 590;
                color: #e7eafe;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 420px;
            }
            .luma-auto-progress {
                font-size: 11px;
                color: #cad3ff;
                white-space: nowrap;
                opacity: 0.88;
            }
            .luma-auto-actions {
                display: flex;
                gap: 6px;
                align-items: center;
                justify-content: flex-end;
                flex-shrink: 0;
            }
            .luma-auto-btn {
                border: none;
                background: transparent;
                color: #dbe6ff;
                border-radius: 8px;
                padding: 6px;
                font-size: 10px;
                font-weight: 620;
                cursor: pointer;
                line-height: 1;
                letter-spacing: 0.01em;
                transition: color 120ms ease, opacity 120ms ease, transform 120ms ease, background 120ms ease;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 28px;
                min-height: 28px;
                opacity: 0.88;
            }
            .luma-auto-btn:hover {
                background: rgba(148, 163, 184, 0.16);
                color: #f8fbff;
                opacity: 1;
            }
            .luma-auto-btn:focus-visible {
                outline: none;
                box-shadow: 0 0 0 2px rgba(125, 211, 252, 0.32);
            }
            .luma-auto-btn.primary {
                color: #a5b4fc;
                background: rgba(99, 102, 241, 0.14);
            }
            .luma-auto-btn.danger {
                color: #fca5a5;
                background: rgba(239, 68, 68, 0.12);
            }
            .luma-auto-btn[data-role="pause-resume"] {
                color: #c7d2fe;
                background: rgba(129, 140, 248, 0.10);
            }
            .luma-auto-btn.primary:hover {
                background: rgba(99, 102, 241, 0.22);
                color: #c7d2fe;
            }
            .luma-auto-btn.danger:hover {
                background: rgba(239, 68, 68, 0.2);
                color: #fecaca;
            }
            .luma-auto-btn[data-role="pause-resume"]:hover {
                background: rgba(129, 140, 248, 0.2);
                color: #e0e7ff;
            }
            .luma-auto-authorize {
                display: none;
            }
            .luma-auto-btn svg {
                width: 15px;
                height: 15px;
                stroke: currentColor;
                stroke-width: 2.25;
                fill: none;
                stroke-linecap: round;
                stroke-linejoin: round;
            }
            .luma-auto-btn.icon-only {
                padding: 6px;
            }
            .luma-auto-overlay.show {
                display: flex;
                opacity: 1;
            }
            .luma-auto-overlay.show .luma-auto-toolbar {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
            @keyframes luma-edge-breathe {
                0%, 100% {
                    opacity: 0.64;
                }
                50% {
                    opacity: 0.74;
                }
            }
            @media (max-width: 760px) {
                .luma-auto-toolbar {
                    width: calc(100vw - 14px);
                    border-radius: 16px;
                    padding: 8px;
                    align-items: flex-start;
                    flex-direction: column;
                    gap: 8px;
                }
                .luma-auto-main {
                    width: 100%;
                    justify-content: space-between;
                }
                .luma-auto-status {
                    max-width: 58vw;
                }
                .luma-auto-actions {
                    width: 100%;
                    justify-content: flex-end;
                }
            }
        `;

        this.container = document.createElement("div");
        this.container.className = "luma-auto-overlay";
        this.container.innerHTML = `
            <div class="luma-auto-blocker" aria-hidden="true"></div>
            <div class="luma-auto-vignette"></div>
            <div class="luma-auto-toolbar">
                <div class="luma-auto-dot"></div>
                <div class="luma-auto-main">
                    <div class="luma-auto-status">${this.strings.autopilotRunning}</div>
                    <div class="luma-auto-progress"></div>
                </div>
                <div class="luma-auto-actions">
                    <button class="luma-auto-btn icon-only" data-role="pause-resume" aria-label="${this.strings.pauseAutomation}" title="${this.strings.pauseAutomation}">
                        <svg viewBox="0 0 24 24"><line x1="9" y1="5" x2="9" y2="19"></line><line x1="15" y1="5" x2="15" y2="19"></line></svg>
                    </button>
                    <button class="luma-auto-btn danger icon-only" data-role="stop" aria-label="${this.strings.stopAutomation}" title="${this.strings.stopAutomation}">
                        <svg viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line></svg>
                    </button>
                    <button class="luma-auto-btn primary icon-only luma-auto-authorize" data-role="authorize" aria-label="${this.strings.authorizeAction}" title="${this.strings.authorizeAction}">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7L9 18l-5-5"></path></svg>
                    </button>
                </div>
            </div>
        `;

        this.shadowRoot.appendChild(style);
        this.shadowRoot.appendChild(this.container);

        this.statusEl = this.container.querySelector(".luma-auto-status") as HTMLElement;
        this.progressEl = this.container.querySelector(".luma-auto-progress") as HTMLElement;
        this.pauseResumeBtn = this.container.querySelector('[data-role="pause-resume"]') as HTMLButtonElement;
        this.stopBtn = this.container.querySelector('[data-role="stop"]') as HTMLButtonElement;
        this.authorizeBtn = this.container.querySelector('[data-role="authorize"]') as HTMLButtonElement;

        this.pauseResumeBtn.onclick = () => {
            this.paused = !this.paused;
            this.pauseResumeBtn.setAttribute("aria-label", this.paused ? this.strings.resumeAutomation : this.strings.pauseAutomation);
            this.pauseResumeBtn.setAttribute("title", this.paused ? this.strings.resumeAutomation : this.strings.pauseAutomation);
            this.pauseResumeBtn.innerHTML = this.paused
                ? `<svg viewBox="0 0 24 24"><polygon points="8 6 18 12 8 18 8 6"></polygon></svg>`
                : `<svg viewBox="0 0 24 24"><line x1="9" y1="5" x2="9" y2="19"></line><line x1="15" y1="5" x2="15" y2="19"></line></svg>`;
            if (this.paused) this.options.onPause();
            else this.options.onResume();
        };
        this.stopBtn.onclick = () => this.options.onStop();
        this.authorizeBtn.onclick = () => this.options.onAuthorize();
    }

    show(status?: string) {
        this.visible = true;
        this.container.classList.add("show");
        this.paused = false;
        this.pauseResumeBtn.setAttribute("aria-label", this.strings.pauseAutomation);
        this.pauseResumeBtn.setAttribute("title", this.strings.pauseAutomation);
        this.pauseResumeBtn.innerHTML = `<svg viewBox="0 0 24 24"><line x1="9" y1="5" x2="9" y2="19"></line><line x1="15" y1="5" x2="15" y2="19"></line></svg>`;
        this.setNeedsAuthorization(false);
        if (status) this.setStatus(status);
    }

    hide() {
        this.visible = false;
        this.container.classList.remove("show");
        this.setNeedsAuthorization(false);
        this.progressEl.textContent = "";
    }

    setStatus(text: string) {
        this.statusEl.textContent = text;
    }

    setProgress(current: number, total: number, label?: string) {
        this.progressEl.textContent = this.strings.stepProgress(current, total, label);
    }

    setPaused(paused: boolean) {
        this.paused = paused;
        this.pauseResumeBtn.setAttribute("aria-label", paused ? this.strings.resumeAutomation : this.strings.pauseAutomation);
        this.pauseResumeBtn.setAttribute("title", paused ? this.strings.resumeAutomation : this.strings.pauseAutomation);
        this.pauseResumeBtn.innerHTML = paused
            ? `<svg viewBox="0 0 24 24"><polygon points="8 6 18 12 8 18 8 6"></polygon></svg>`
            : `<svg viewBox="0 0 24 24"><line x1="9" y1="5" x2="9" y2="19"></line><line x1="15" y1="5" x2="15" y2="19"></line></svg>`;
    }

    setNeedsAuthorization(show: boolean, message?: string) {
        this.authorizeBtn.style.display = show ? "inline-flex" : "none";
        this.pauseResumeBtn.style.display = show ? "none" : "inline-flex";
        this.stopBtn.style.display = "inline-flex";
        if (show && message) {
            this.statusEl.textContent = message;
        }
    }

    get isVisible() {
        return this.visible;
    }

    setLocale(locale?: string) {
        this.strings = resolveSdkStrings(locale);
        this.statusEl.textContent = this.strings.autopilotRunning;
        this.pauseResumeBtn.setAttribute("aria-label", this.paused ? this.strings.resumeAutomation : this.strings.pauseAutomation);
        this.pauseResumeBtn.setAttribute("title", this.paused ? this.strings.resumeAutomation : this.strings.pauseAutomation);
        this.stopBtn.setAttribute("aria-label", this.strings.stopAutomation);
        this.stopBtn.setAttribute("title", this.strings.stopAutomation);
        this.authorizeBtn.setAttribute("aria-label", this.strings.authorizeAction);
        this.authorizeBtn.setAttribute("title", this.strings.authorizeAction);
    }
}
