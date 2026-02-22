import type { GuidancePlan } from "@luma/core";

export class Tooltip {
    private host: HTMLElement;
    private shadowRoot: ShadowRoot;
    private tooltipEl: HTMLElement;
    private targetEl: Element | null = null;
    private isVisible: boolean = false;
    private resizeObserver: ResizeObserver;
    private onDismiss: () => void;
    private onAction: (walkthroughId: string, stepId: string) => void;
    private onBack: (walkthroughId: string, stepId: string) => void;
    private onInteraction: (selector: string) => void;
    private isChatOpen: () => boolean;
    private positionInterval: number | null = null;
    private targetSearchInterval: number | null = null;
    private currentRawSelector: string = "";
    private currentWalkthroughId: string | null = null;
    private currentStepId: string | null = null;
    private handleTargetClick: (e: Event) => void;
    private focusedEl: HTMLElement | null = null;
    private focusStyleEl: HTMLStyleElement | null = null;
    private overlayEl: HTMLElement | null = null;

    // Configurable
    private offset: number = 8;

    constructor(
        onDismiss: () => void,
        onAction: (walkthroughId: string, stepId: string) => void,
        onBack: (walkthroughId: string, stepId: string) => void,
        onInteraction: (selector: string) => void,
        isChatOpen: () => boolean = () => false
    ) {
        this.onDismiss = onDismiss;
        this.onAction = onAction;
        this.onBack = onBack;
        this.onInteraction = onInteraction;
        this.isChatOpen = isChatOpen;
        this.handleTargetClick = () => {
            // Deterministic step advance when user clicks the highlighted target.
            // This avoids getting stuck if selector normalization differs across events.
            if (this.currentWalkthroughId && this.currentStepId) {
                this.onAction(this.currentWalkthroughId, this.currentStepId);
                return;
            }
            this.onInteraction(this.currentRawSelector);
        };

        // 1. Create Host Element
        const existingHost = document.getElementById("luma-tooltip-host");
        if (existingHost) {
            existingHost.remove();
        }

        this.host = document.createElement("div");
        this.host.id = "luma-tooltip-host";
        this.host.style.position = "absolute";
        this.host.style.top = "0";
        this.host.style.left = "0";
        this.host.style.width = "100%";
        this.host.style.height = "0"; // Don't block interactions
        this.host.style.pointerEvents = "none";
        this.host.style.zIndex = "2147483647"; // Max z-index
        document.body.appendChild(this.host);

        // 2. Attach Shadow DOM (Open mode so we can inspect it if needed)
        this.shadowRoot = this.host.attachShadow({ mode: "open" });

        // 3. Inject Styles
        this.injectStyles();

        // 4. Create Tooltip Element
        this.tooltipEl = document.createElement("div");
        this.tooltipEl.className = "luma-tooltip";
        this.tooltipEl.innerHTML = `
            <div class="luma-tooltip-caret"></div>
            <div class="luma-tooltip-caret-patch"></div>
            <button class="luma-tooltip-close" aria-label="Cerrar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            <div class="luma-tooltip-header"></div>
            <div class="luma-tooltip-content"></div>
            <div class="luma-tooltip-actions"></div>
        `;

        // Bind internal close handler
        const closeBtn = this.tooltipEl.querySelector(".luma-tooltip-close") as HTMLButtonElement;
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            this.hide();
            this.onDismiss();
        };

        this.shadowRoot.appendChild(this.tooltipEl);

        // 5. Setup Observers
        this.resizeObserver = new ResizeObserver(() => {
            if (this.isVisible) this.updatePosition();
        });

        window.addEventListener("scroll", () => {
            if (this.isVisible) this.updatePosition();
        }, { passive: true });

        window.addEventListener("resize", () => {
            if (this.isVisible) this.updatePosition();
        }, { passive: true });
    }

    private injectStyles() {
        const style = document.createElement("style");

        // Use CSS Variables for easy theming
        style.textContent = `
            :host {
                /* Light Theme Variables */
                --luma-bg: #ffffff;
                --luma-text: #1f2937;
                --luma-text-muted: #6b7280;
                --luma-border: #e5e7eb;
                --luma-primary: #4f46e5;
                --luma-primary-hover: #4338ca;
                --luma-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                --luma-radius: 12px;
                --luma-font: 'Inter', system-ui, -apple-system, sans-serif;
                
                all: initial; /* Reset cascade inside host */
            }

            .luma-tooltip {
                position: fixed; /* Fixed to viewport */
                top: 0;
                left: 0;
                width: 320px;
                background-color: var(--luma-bg);
                border: 1px solid var(--luma-border);
                border-radius: var(--luma-radius);
                box-shadow: var(--luma-shadow);
                font-family: var(--luma-font);
                color: var(--luma-text);
                opacity: 0;
                visibility: hidden;
                transform: scale(0.95);
                transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), 
                            transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                            visibility 0s 0.2s;
                pointer-events: auto; /* Enable clicks inside tooltip */
                padding: 20px;
                box-sizing: border-box;
                z-index: 100;
            }

            /* Visible State */
            .luma-tooltip.luma-visible {
                opacity: 1;
                visibility: visible;
                transform: scale(1);
                transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
                            transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }

            /* Caret (Arrow) */
            .luma-tooltip-caret {
                position: absolute;
                width: 16px;
                height: 16px;
                background-color: var(--luma-bg);
                border: 1px solid var(--luma-border);
                transform: rotate(45deg);
                pointer-events: none;
                z-index: -1;
            }

            /* Caret Patch (Hides the border overlap seamlessly) */
            .luma-tooltip-caret-patch {
                position: absolute;
                background-color: var(--luma-bg);
                pointer-events: none;
                z-index: 0;
            }

            /* Caret Positions */
            .luma-tooltip[data-placement="top"] .luma-tooltip-caret {
                bottom: -8.5px;
                border-top-color: transparent;
                border-left-color: transparent;
            }
            .luma-tooltip[data-placement="top"] .luma-tooltip-caret-patch {
                bottom: 0px;
                height: 2px;
                width: 24px;
                transform: translateX(-50%);
            }

            .luma-tooltip[data-placement="bottom"] .luma-tooltip-caret {
                top: -8.5px;
                border-bottom-color: transparent;
                border-right-color: transparent;
            }
            .luma-tooltip[data-placement="bottom"] .luma-tooltip-caret-patch {
                top: 0px;
                height: 2px;
                width: 24px;
                transform: translateX(-50%);
            }

            .luma-tooltip[data-placement="left"] .luma-tooltip-caret {
                right: -8.5px;
                border-bottom-color: transparent;
                border-left-color: transparent;
            }
            .luma-tooltip[data-placement="left"] .luma-tooltip-caret-patch {
                right: 0px;
                width: 2px;
                height: 24px;
                transform: translateY(-50%);
            }

            .luma-tooltip[data-placement="right"] .luma-tooltip-caret {
                left: -8.5px;
                border-top-color: transparent;
                border-right-color: transparent;
            }
            .luma-tooltip[data-placement="right"] .luma-tooltip-caret-patch {
                left: 0px;
                width: 2px;
                height: 24px;
                transform: translateY(-50%);
            }

            /* Close Button */
            .luma-tooltip-close {
                position: absolute;
                top: 12px;
                right: 12px;
                background: transparent;
                border: none;
                color: var(--luma-text-muted);
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background-color 0.2s, color 0.2s;
            }

            .luma-tooltip-close:hover {
                background-color: #f3f4f6;
                color: var(--luma-text);
            }

            /* Content Typography */
            .luma-tooltip-header {
                font-size: 14px;
                font-weight: 700;
                color: var(--luma-primary);
                margin-bottom: 8px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            /* Optional icon in header */
            .luma-tooltip-header svg {
                width: 16px;
                height: 16px;
            }

            .luma-tooltip-content {
                font-size: 15px;
                line-height: 1.5;
                font-weight: 500;
                word-wrap: break-word; /* Ensure long words don't break layout */
            }

            /* Actions List */
            .luma-tooltip-actions {
                margin-top: 16px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .luma-action-btn {
                background-color: var(--luma-bg);
                border: 1px solid var(--luma-primary);
                color: var(--luma-primary);
                padding: 10px 16px;
                border-radius: 8px;
                font-family: inherit;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                text-align: left;
                display: flex;
                align-items: center;
                justify-content: space-between;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            }

            .luma-action-btn:hover {
                background-color: var(--luma-primary);
                color: white;
                transform: translateY(-1px);
                box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);
            }

            .luma-action-btn:active {
                transform: translateY(0);
            }

            /* Markdown Support inside content */
            .luma-tooltip-content p { margin: 0 0 12px 0; }
            .luma-tooltip-content p:last-child { margin: 0; }
            .luma-tooltip-content strong { color: var(--luma-text); font-weight: 700; }
            .luma-tooltip-content code {
                background: #f3f4f6;
                padding: 2px 4px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 0.9em;
                color: #ef4444;
            }

            /* Step counter & progress */
            .luma-step-name {
                font-size: 13px;
                font-weight: 700;
                color: var(--luma-primary);
                margin-bottom: 10px;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .luma-progress-bar {
                width: 100%;
                height: 3px;
                background: #e5e7eb;
                border-radius: 9999px;
                margin-bottom: 14px;
                overflow: hidden;
            }
            .luma-progress-fill {
                height: 100%;
                background: var(--luma-primary);
                border-radius: 9999px;
                transition: width 0.4s ease;
            }

            /* Target hash badge */
            .luma-target-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                margin-top: 12px;
                padding: 4px 10px;
                background: #ede9fe;
                color: #6d28d9;
                border-radius: 6px;
                font-size: 11px;
                font-weight: 700;
                font-family: monospace;
                cursor: pointer;
                border: 1px solid #ddd6fe;
                transition: background 0.15s;
                pointer-events: auto;
            }
            .luma-target-badge:hover { background: #ddd6fe; }

            /* Action buttons */
            .luma-tooltip-actions {
                margin-top: 16px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                align-items: center;
                justify-content: center;
                width: 100%;
            }
            .luma-action-btn {
                background-color: var(--luma-bg);
                border: 1px solid var(--luma-primary);
                color: var(--luma-primary);
                padding: 9px 14px;
                border-radius: 8px;
                font-family: inherit;
                font-size: 15px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 6px;
                justify-content: center;
                width: min(240px, 100%);
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            }
            .luma-action-btn:hover {
                background-color: #f5f3ff;
                transform: translateY(-1px);
                box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.15);
            }
            .luma-action-btn--primary {
                background-color: var(--luma-primary);
                color: white;
                justify-content: center;
            }
            .luma-action-btn--primary:hover {
                background-color: var(--luma-primary-hover);
                color: white;
            }
            .luma-action-btn--secondary {
                background-color: #f5f3ff;
                color: var(--luma-primary);
                border-color: #c7d2fe;
            }
            .luma-action-btn--secondary:hover {
                background-color: #ede9fe;
                color: #4338ca;
            }
        `;

        this.shadowRoot.appendChild(style);
    }

    public render(plan: GuidancePlan | null) {

        if (!plan || !plan.message || !plan.metadata?.targetSelector) {
            this.hide();
            return;
        }

        // Clear any previous scheduled searches
        if (this.targetSearchInterval) {
            clearInterval(this.targetSearchInterval);
            this.targetSearchInterval = null;
        }

        // Remove old target listeners and focus ring
        if (this.targetEl && this.targetEl !== document.body) {
            (this.targetEl as HTMLElement).removeEventListener("click", this.handleTargetClick);
        }
        this.unfocusTarget();
        this.targetEl = null;

        const selector = plan.metadata.targetSelector;
        this.currentRawSelector = selector;
        this.currentWalkthroughId = (plan.metadata?.walkthroughId as string | undefined) || null;
        this.currentStepId = (plan.metadata?.stepId as string | undefined) || null;

        let attempts = 0;
        const maxAttempts = 50; // 50 * 100ms = 5s max (for SPA navigation)

        const tryAttach = () => {
            const element = selector === "body"
                ? document.body
                : document.querySelector(selector);

            if (element) {
                if (this.targetSearchInterval) {
                    clearInterval(this.targetSearchInterval);
                    this.targetSearchInterval = null;
                }

                this.targetEl = element;
                this.focusTarget(element as HTMLElement);

                if (this.targetEl !== document.body) {
                    (this.targetEl as HTMLElement).addEventListener("click", this.handleTargetClick, { once: true });
                }

                this.populateContent(plan);
                this.show();
                this.startTracking();
            } else {
                attempts++;
                if (attempts >= maxAttempts) {
                    console.warn(`LumaWay Tooltip: Target "${selector}" not found after 5s.`);
                    if (this.targetSearchInterval) clearInterval(this.targetSearchInterval);
                    this.targetSearchInterval = null;
                    // Don't hide — tooltip stays if visible, and re-renders on next navigation
                }
            }
        };

        tryAttach();
        if (!this.targetEl) {
            this.targetSearchInterval = window.setInterval(tryAttach, 100);
        }
    }

    private populateContent(plan: GuidancePlan) {
        const header = this.tooltipEl.querySelector(".luma-tooltip-header")!;
        const content = this.tooltipEl.querySelector(".luma-tooltip-content")!;
        const actionsContainer = this.tooltipEl.querySelector(".luma-tooltip-actions")!;

        const configName = (plan.config as any)?.settings?.assistantName || (plan.config as any)?.name || "Luma";
        const stepName = plan.metadata?.stepName as string | undefined;
        const stepIndex = plan.metadata?.stepIndex as number | undefined;
        const totalSteps = plan.metadata?.totalSteps as number | undefined;
        const targetSelector = plan.metadata?.targetSelector as string | undefined;
        const walkthroughId = plan.metadata?.walkthroughId as string | undefined;
        const stepId = plan.metadata?.stepId as string | undefined;

        const hasCounter = typeof stepIndex === 'number' && typeof totalSteps === 'number';
        const progress = hasCounter ? Math.round(((stepIndex + 1) / totalSteps) * 100) : 0;
        const hasPrevious = hasCounter && typeof stepIndex === "number" && stepIndex > 0;

        // ---- Build Header ----
        header.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            <span>${configName}</span>
            ${hasCounter ? `<span style="margin-left:auto;font-size:11px;font-weight:500;color:var(--luma-text-muted);">Paso ${stepIndex! + 1} / ${totalSteps}</span>` : ''}
        `;

        // ---- Build Content ----
        let contentHtml = '';

        // Progress bar
        if (hasCounter) {
            contentHtml += `
                <div class="luma-progress-bar">
                    <div class="luma-progress-fill" style="width:${progress}%"></div>
                </div>
            `;
        }

        // Step name — simple label, no icon
        if (stepName) {
            contentHtml += `<div class="luma-step-name">▸ ${stepName}</div>`;
        }

        // Description
        contentHtml += `<div class="luma-tooltip-description">${this.renderMarkdown(plan.message)}</div>`;

        content.innerHTML = contentHtml;

        // ---- Build Actions ----
        actionsContainer.innerHTML = '';

        // Previous button
        if (walkthroughId && stepId && hasPrevious) {
            const prevBtn = document.createElement('button');
            prevBtn.className = 'luma-action-btn luma-action-btn--secondary';
            prevBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
                </svg>
                Anterior
            `;
            prevBtn.onclick = () => this.onBack(walkthroughId, stepId);
            actionsContainer.appendChild(prevBtn);
        }

        // "Siguiente / Saltar / Finalizar" button
        if (plan.suggestedAction && walkthroughId && stepId) {
            const nextBtn = document.createElement('button');
            nextBtn.className = 'luma-action-btn luma-action-btn--primary';
            const isLast = hasCounter && stepIndex === totalSteps! - 1;
            // When there's a target on page: label as "Saltar" (skip)
            // When it's the last step: "Finalizar"
            // Otherwise: standard "Siguiente"
            let btnLabel = isLast ? '✅ Finalizar' : (targetSelector && targetSelector !== 'body' ? 'Saltar' : 'Siguiente');
            nextBtn.innerHTML = `
                ${btnLabel}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
            `;
            nextBtn.onclick = () => this.onAction(walkthroughId, stepId);
            actionsContainer.appendChild(nextBtn);
        }

        // Additional possible actions (branching)
        if (plan.possibleActions && plan.possibleActions.length > 0) {
            plan.possibleActions.forEach(action => {
                const btn = document.createElement('button');
                btn.className = 'luma-action-btn';
                btn.textContent = action.title;
                btn.onclick = () => this.onAction(action.walkthroughId, action.stepId);
                actionsContainer.appendChild(btn);
            });
        }
    }

    private renderMarkdown(text: string): string {
        let html = text
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // Bold
            .replace(/\*(.*?)\*/g, "<em>$1</em>")             // Italic
            .replace(/`(.*?)`/g, "<code>$1</code>")           // Inline code
            .replace(/\n\n/g, "</p><p>")                      // Paragraphs
            .replace(/\n/g, "<br>");                          // Line breaks

        return `<p>${html}</p>`;
    }

    private show() {
        if (!this.targetEl) return;
        this.isVisible = true;
        this.showOverlay();
        this.tooltipEl.classList.add("luma-visible");
        this.resizeObserver.observe(this.targetEl);
        this.updatePosition();

        if (this.targetEl !== document.body) {
            const htmlEl = this.targetEl as HTMLElement;
            if (window.getComputedStyle(this.targetEl).position === 'static') {
                htmlEl.style.position = 'relative';
            }
        }
    }

    private hide() {
        this.isVisible = false;
        this.tooltipEl.classList.remove("luma-visible");
        this.hideOverlay();

        if (this.targetSearchInterval) {
            clearInterval(this.targetSearchInterval);
            this.targetSearchInterval = null;
        }

        if (this.targetEl) {
            this.resizeObserver.unobserve(this.targetEl);
            if (this.targetEl !== document.body) {
                (this.targetEl as HTMLElement).removeEventListener("click", this.handleTargetClick);
            }
        }
        this.unfocusTarget();
        this.stopTracking();
        this.targetEl = null;
        this.currentWalkthroughId = null;
        this.currentStepId = null;
    }

    private focusTarget(el: HTMLElement) {
        this.unfocusTarget(); // clear any previous

        // Inject a global <style> into the page DOM (not shadow DOM) to apply the ring and overlay
        if (!this.focusStyleEl) {
            this.focusStyleEl = document.createElement('style');
            this.focusStyleEl.id = 'luma-focus-style';
            this.focusStyleEl.textContent = `
                .luma-target-focus {
                    outline: 3px solid #4f46e5 !important;
                    outline-offset: 4px !important;
                    border-radius: 8px;
                    box-shadow: 0 0 0 6px rgba(79, 70, 229, 0.35), 0 0 20px rgba(79, 70, 229, 0.25) !important;
                    animation: luma-pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                    position: relative !important;
                    z-index: 2147483647 !important;
                    transition: outline 0.2s, box-shadow 0.2s;
                }
                @keyframes luma-pulse {
                    0%, 100% { box-shadow: 0 0 0 6px rgba(79, 70, 229, 0.35), 0 0 20px rgba(79, 70, 229, 0.2); }
                    50%       { box-shadow: 0 0 0 10px rgba(79, 70, 229, 0.2), 0 0 28px rgba(79, 70, 229, 0.35); }
                }
            `;
            document.head.appendChild(this.focusStyleEl);
        }

        el.classList.add('luma-target-focus');
        this.focusedEl = el;

        // Scroll into view smoothly if off-screen
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }

    private showOverlay() {
        if (this.overlayEl) return;
        this.overlayEl = document.createElement('div');
        this.overlayEl.id = 'luma-spotlight-overlay';
        this.overlayEl.setAttribute('aria-hidden', 'true');
        this.overlayEl.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.45);
            z-index: 2147483646;
            pointer-events: none;
            transition: opacity 0.25s ease;
        `;
        document.body.appendChild(this.overlayEl);
    }

    private hideOverlay() {
        if (this.overlayEl && this.overlayEl.parentNode) {
            this.overlayEl.parentNode.removeChild(this.overlayEl);
            this.overlayEl = null;
        }
    }

    private unfocusTarget() {
        if (this.focusedEl) {
            this.focusedEl.classList.remove('luma-target-focus');
            this.focusedEl = null;
        }
    }

    private startTracking() {
        if (this.positionInterval) return;
        // Check position frequently to lock tooltip to element during animations/scrolls
        this.positionInterval = window.setInterval(() => {
            if (this.isVisible) this.updatePosition();
        }, 30); // ~30fps
    }

    private stopTracking() {
        if (this.positionInterval) {
            clearInterval(this.positionInterval);
            this.positionInterval = null;
        }
    }

    private updatePosition() {
        if (!this.targetEl || !this.isVisible) return;

        // Force tooltip to display so we can measure it accurately
        const isHiddenRaw = this.tooltipEl.style.display === "none";
        if (isHiddenRaw) this.tooltipEl.style.display = "block";

        const targetRect = this.targetEl.getBoundingClientRect();

        // Prevent layout thrashing
        const ttWidth = this.tooltipEl.offsetWidth;
        const ttHeight = this.tooltipEl.offsetHeight;
        const ttPadding = 20; // Matches CSS padding

        // If target is invisible offscreen, hide tooltip
        if (targetRect.width === 0 || targetRect.height === 0 ||
            targetRect.bottom < 0 || targetRect.top > window.innerHeight ||
            targetRect.right < 0 || targetRect.left > window.innerWidth) {
            this.tooltipEl.style.opacity = "0";
            return;
        } else {
            this.tooltipEl.style.opacity = "1";
        }

        // Logical viewport accounting for the open chat (410px) to prevent overlapping
        const effectiveRightMargin = this.isChatOpen() ? 410 : 0;
        const viewportWidth = window.innerWidth - effectiveRightMargin;
        const viewportHeight = window.innerHeight;

        // Default constraints
        let top = 0;
        let left = 0;
        let placement = "bottom";

        // Calculate available space
        const spaceTop = targetRect.top;
        const spaceBottom = viewportHeight - targetRect.bottom;
        const spaceLeft = targetRect.left;
        const spaceRight = viewportWidth - targetRect.right;

        // Decide optimal placement
        // Priority: Bottom -> Top -> Right -> Left
        if (spaceBottom >= ttHeight + this.offset) {
            placement = "bottom";
        } else if (spaceTop >= ttHeight + this.offset) {
            placement = "top";
        } else if (spaceRight >= ttWidth + this.offset) {
            placement = "right";
        } else if (spaceLeft >= ttWidth + this.offset) {
            placement = "left";
        } else {
            placement = "bottom"; // Fallback
        }

        // Calculate Caret Center Position constraint (relative to tooltip)
        let caretLeft = 0;
        let caretTop = 0;

        const targetCenterX = targetRect.left + targetRect.width / 2;
        const targetCenterY = targetRect.top + targetRect.height / 2;
        const caretMin = ttPadding + 8;
        const caretMax = ttWidth - ttPadding - 8;
        const caretTopMin = ttPadding + 8;
        const caretTopMax = ttHeight - ttPadding - 8;
        const safeMargin = 16;

        // Calculate Position
        switch (placement) {
            case "top":
            case "bottom":
                // Start with tooltip centered on target
                left = targetCenterX - ttWidth / 2;
                caretLeft = targetCenterX - left;

                // Clamp caret inside tooltip, then shift tooltip so caret still points at target
                caretLeft = Math.max(caretMin, Math.min(caretLeft, caretMax));
                left = targetCenterX - caretLeft;

                // Keep tooltip within viewport
                if (left < safeMargin) left = safeMargin;
                if (left + ttWidth > viewportWidth - safeMargin) left = viewportWidth - ttWidth - safeMargin;
                // Recompute caret so it points at target (may be clamped visually but tooltip is in bounds)
                caretLeft = targetCenterX - left;
                caretLeft = Math.max(caretMin, Math.min(caretLeft, caretMax));

                top = placement === "top"
                    ? targetRect.top - ttHeight - this.offset
                    : targetRect.bottom + this.offset;
                break;

            case "left":
            case "right":
                top = targetCenterY - ttHeight / 2;
                caretTop = targetCenterY - top;
                caretTop = Math.max(caretTopMin, Math.min(caretTop, caretTopMax));
                top = targetCenterY - caretTop;

                if (top < safeMargin) top = safeMargin;
                if (top + ttHeight > viewportHeight - safeMargin) top = viewportHeight - ttHeight - safeMargin;
                caretTop = targetCenterY - top;
                caretTop = Math.max(caretTopMin, Math.min(caretTop, caretTopMax));

                left = placement === "left"
                    ? targetRect.left - ttWidth - this.offset
                    : targetRect.right + this.offset;
                break;
        }

        // Apply placement data attribute for CSS styling logic
        this.tooltipEl.dataset.placement = placement;

        // Apply transforms (using translate3d for hardware acceleration)
        this.tooltipEl.style.transform = `translate3d(${left}px, ${top}px, 0)`;

        // Position caret using CSS custom properties via style
        const caretEl = this.tooltipEl.querySelector(".luma-tooltip-caret") as HTMLElement;
        const caretPatchEl = this.tooltipEl.querySelector(".luma-tooltip-caret-patch") as HTMLElement;

        if (caretEl && caretPatchEl) {
            // Reset ALL positioning
            caretEl.style.left = "";
            caretEl.style.right = "";
            caretEl.style.top = "";
            caretEl.style.bottom = "";
            caretPatchEl.style.left = "";
            caretPatchEl.style.right = "";
            caretPatchEl.style.top = "";
            caretPatchEl.style.bottom = "";

            if (placement === "top" || placement === "bottom") {
                // Center is offset by half of caret width (8px)
                caretEl.style.left = `${caretLeft - 8}px`;
                caretPatchEl.style.left = `${caretLeft}px`; // Patch is translated -50% in CSS
            } else {
                caretEl.style.top = `${caretTop - 8}px`;
                caretPatchEl.style.top = `${caretTop}px`;
            }
        }

        if (isHiddenRaw) this.tooltipEl.style.display = "";
    }
}
