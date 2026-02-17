import { GuidancePlan } from '@luma/types';

export class Tooltip {
    private element: HTMLElement;
    private textElement: HTMLElement;
    private dismissButton: HTMLElement;

    constructor(onDismiss: () => void) {
        this.element = document.createElement('div');
        this.element.style.position = 'fixed'; // Antigravity: Fixed positioning, high z-index but not blocking
        this.element.style.padding = '12px';
        this.element.style.background = '#333';
        this.element.style.color = '#fff';
        this.element.style.borderRadius = '6px';
        this.element.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
        this.element.style.zIndex = '9999';
        this.element.style.pointerEvents = 'auto'; // Interactive itself
        this.element.style.transition = 'opacity 0.2s, transform 0.2s';
        this.element.style.opacity = '0';
        this.element.style.pointerEvents = 'none'; // Hidden by default

        this.textElement = document.createElement('span');
        this.element.appendChild(this.textElement);

        this.dismissButton = document.createElement('button');
        this.dismissButton.textContent = '×';
        this.dismissButton.style.marginLeft = '8px';
        this.dismissButton.style.background = 'transparent';
        this.dismissButton.style.border = 'none';
        this.dismissButton.style.color = '#ccc';
        this.dismissButton.style.cursor = 'pointer';
        this.dismissButton.onclick = (e) => {
            e.stopPropagation();
            onDismiss();
        };
        this.element.appendChild(this.dismissButton);

        document.body.appendChild(this.element);
    }

    public render(plan: GuidancePlan): void {
        if (!plan.isVisible || !plan.content) {
            this.hide();
            return;
        }

        this.textElement.textContent = plan.content.text;

        // Positioning logic
        if (plan.content.targetSelector) {
            const target = document.querySelector(plan.content.targetSelector);
            if (target) {
                const rect = target.getBoundingClientRect();
                // Simple positioning logic (Antigravity: adapts to position)
                // Defaulting to "bottom" for MVP
                this.element.style.top = `${rect.bottom + 10}px`;
                this.element.style.left = `${rect.left}px`;
            } else {
                // Fallback: bottom right if target not found? Or hide?
                // Antigravity: Stay silent if strictly targeted.
                // For now, let's just log or hide.
                // this.hide(); // Ideally.
                // But for testing, maybe show somewhere or wait for element?
                // Let's hide if target missing.
                this.hide();
                return;
            }
        } else {
            // Global message?
            this.element.style.bottom = '20px';
            this.element.style.right = '20px';
            this.element.style.top = 'auto';
            this.element.style.left = 'auto';
        }

        this.show();
    }

    private show(): void {
        this.element.style.opacity = '1';
        this.element.style.pointerEvents = 'auto';
    }

    private hide(): void {
        this.element.style.opacity = '0';
        this.element.style.pointerEvents = 'none';
    }
}
