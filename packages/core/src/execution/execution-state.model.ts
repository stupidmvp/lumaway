export interface ExecutionState {
    projectId: string;
    userId: string;

    activeWalkthroughId?: string;
    activeStepId?: string;

    completedWalkthroughs: string[];
    completedSteps: string[];

    history: ExecutionEventRecord[];

    startedAt: number;
    updatedAt: number;
}

export interface ExecutionEventRecord {
    type: string;
    payload?: any;
    timestamp: number;
}
