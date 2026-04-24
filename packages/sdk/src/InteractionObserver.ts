import type { LumaEvent } from "./public-types.js";

export class InteractionObserver {
    private onEvent: (event: LumaEvent) => void;

    constructor(onEvent: (event: LumaEvent) => void) {
        this.onEvent = onEvent;
        this.setupListeners();
    }

    private setupListeners() {
        // 1. Click Tracking
        document.addEventListener("click", (e) => {
            const target = e.target as HTMLElement;
            if (!target) return;

            // Capture semantic identifiers
            const selector = this.getSemanticSelector(target);

            this.onEvent({
                type: "interaction.detected",
                interactionType: "click",
                target: selector,
                metadata: {
                    text: target.innerText?.substring(0, 50),
                    id: target.id,
                    className: target.className
                }
            });
        }, true);

        // 2. Focused Inputs (Potential intent)
        document.addEventListener("focusin", (e) => {
            const target = e.target as HTMLElement;
            if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
                this.onEvent({
                    type: "interaction.detected",
                    interactionType: "focus",
                    target: this.getSemanticSelector(target),
                });
            }
        }, true);
    }

    private getSemanticSelector(el: HTMLElement): string {
        if (el.id) return `#${el.id}`;

        // Try to find a stable data attribute or class
        const dataAttr = Array.from(el.attributes).find(a => a.name.startsWith("data-"));
        if (dataAttr) return `[${dataAttr.name}="${dataAttr.value}"]`;

        // Fallback to tag + class
        const tag = el.tagName.toLowerCase();
        const classes = Array.from(el.classList).join(".");
        return classes ? `${tag}.${classes}` : tag;
    }
}
