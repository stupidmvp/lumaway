import { Engine } from '@luma/engine';
import { GuidancePlan } from '@luma/types';
import { Tooltip } from './ui/Tooltip';

export class LumaSDK {
    private engine: Engine;
    private tooltip: Tooltip;
    private currentPlan: GuidancePlan | null = null;

    constructor() {
        this.engine = new Engine();
        this.tooltip = new Tooltip(() => {
            this.engine.sendAction({ type: 'DISMISS' });
        });

        console.log('LumaSDK Initialized 🚀');

        // Subscribe to Engine
        this.engine.subscribe((plan) => {
            this.currentPlan = plan;
            this.tooltip.render(plan);
        });

        // Antigravity: Listen to all interactions to determine intent
        this.setupListeners();

        // Fetch Walkthroughs
        this.fetchWalkthrough();

        // Verification Mock: Auto-start a walkthrough for MVP verification
        // In real app, we fetch from API.
        // For now, let's expose a method to start it or check for a specific ID.
        (window as any).__LUMA_ENGINE__ = this.engine; // Expose for debugging/manual start
    }

    private async fetchWalkthrough(): Promise<void> {
        const apiKey = (window as any).LUMA_API_KEY;
        const apiUrl = (window as any).LUMA_API_URL || 'http://localhost:3001';
        const actorSlug = (window as any).LUMA_ACTOR_SLUG; // Host app sets this to the current user's actor/role slug

        if (!apiKey) {
            console.warn('LumaWay: No API Key found (window.LUMA_API_KEY).');
            return;
        }

        try {
            const headers: Record<string, string> = { 'x-api-key': apiKey };
            if (actorSlug) {
                headers['x-actor-slug'] = actorSlug;
            }

            const response = await fetch(`${apiUrl}/client-walkthroughs`, { headers });
            if (!response.ok) throw new Error(response.statusText);

            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
                console.log('LumaSDK: Starting walkthrough', data[0].title);
                this.engine.start(data[0]);
            }
        } catch (err) {
            console.error('LumaWay: Failed to fetch walkthroughs', err);
        }
    }

    private setupListeners(): void {
        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            // Heuristic: Identify selector
            // This is simplified. In prod we need robust selector generation.
            const selector = target.id ? `#${target.id}` : target.tagName.toLowerCase();

            this.engine.sendAction({
                type: 'ELEMENT_INTERACTION',
                selector: selector
            });

            // If the user clicks the NEXT button of our walkthrough (if we had one), handled by UI?
            // No, UI is rendered by us.
        }, true);
    }
}
