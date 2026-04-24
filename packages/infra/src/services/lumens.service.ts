import { httpClient } from '../http/client';

export type LumenStatus =
    | 'recording'
    | 'uploaded'
    | 'processing'
    | 'ready_for_review'
    | 'failed'
    | 'cancelled';

export interface Lumen {
    id: string;
    projectId: string;
    createdBy?: string | null;
    intent?: string | null;
    status: LumenStatus;
    captureSource?: 'dom' | 'webmcp' | 'hybrid' | 'unknown' | null;
    videoS3Key?: string | null;
    videoDurationMs?: number | null;
    startedAt: string;
    endedAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface LumenReviewPayload {
    session: Lumen & { processingSummary?: Record<string, any> };
    chapters: Array<{
        id: string;
        observerSessionId: string;
        startMs: number;
        endMs: number;
        title: string;
        summary?: string | null;
        createdAt: string;
    }>;
    stepCandidates: Array<{
        id: string;
        observerSessionId: string;
        order: number;
        title: string;
        description: string;
        targetSelector?: string | null;
        timestampMs: number;
        confidence: number;
        metadata?: Record<string, any>;
        createdAt: string;
    }>;
    videoUrl?: string | null;
}

export const LumensService = {
    async getAllByProject(projectId: string, limit: number = 20): Promise<{ data: Lumen[]; total: number } | Lumen[]> {
        const { data } = await httpClient.get('/observer-sessions', {
            params: {
                projectId,
                $sort: { startedAt: -1 },
                $limit: limit,
            },
        });
        return data;
    },
    async getReview(observerSessionId: string): Promise<LumenReviewPayload> {
        const { data } = await httpClient.get('/observer-session-review', {
            params: { observerSessionId },
        });
        return data;
    },
    async reprocess(observerSessionId: string): Promise<{ observerSessionId: string; status: 'queued' }> {
        const { data } = await httpClient.post('/observer-session-reprocess', {
            observerSessionId,
        });
        return data;
    },
    async generateWalkthroughs(
        observerSessionId: string,
        input?: { mode?: 'single' | 'perChapter'; baseTitle?: string }
    ): Promise<{ observerSessionId: string; mode: 'single' | 'perChapter'; createdWalkthroughs: Array<{ walkthroughId: string; title: string; stepsCount: number }> }> {
        const { data } = await httpClient.post('/observer-generate-walkthrough', {
            observerSessionId,
            mode: input?.mode || 'single',
            baseTitle: input?.baseTitle,
        });
        return data;
    },
};
