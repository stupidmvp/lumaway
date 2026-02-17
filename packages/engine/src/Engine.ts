import { Walkthrough, UserAction, GuidancePlan, ExecutionState } from '@luma/types';
import { WalkthroughInteractor } from './interactor/WalkthroughInteractor';
import { GuidancePresenter } from './presenter/GuidancePresenter';

export class Engine {
    private interactor?: WalkthroughInteractor;
    private presenter: GuidancePresenter;
    private subscribers: ((plan: GuidancePlan) => void)[] = [];

    constructor() {
        this.presenter = new GuidancePresenter();
    }

    public start(walkthrough: Walkthrough): void {
        this.interactor = new WalkthroughInteractor(walkthrough);
        this.interactor.subscribe((state) => {
            this.notifySubscribers(state);
        });
        // Initial notification
        this.notifySubscribers(this.interactor.getState());
    }

    public sendAction(action: UserAction): void {
        if (this.interactor) {
            this.interactor.handleAction(action);
        }
    }

    public subscribe(callback: (plan: GuidancePlan) => void): () => void {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(s => s !== callback);
        };
    }

    private notifySubscribers(state: ExecutionState): void {
        if (!this.interactor) return;
        const plan = this.presenter.present(this.interactor.getWalkthrough(), state);
        this.subscribers.forEach(sub => sub(plan));
    }
}
