import { httpClient } from '../http/client';
import { Actor } from './actors.service';

export interface WalkthroughActor {
    walkthroughId: string;
    actorId: string;
    createdAt: string;
    actor: Actor;
}

export const WalkthroughActorsService = {
    async getByWalkthrough(walkthroughId: string): Promise<WalkthroughActor[]> {
        const { data } = await httpClient.get<WalkthroughActor[]>('/walkthrough-actors', {
            params: { walkthroughId }
        });
        return Array.isArray(data) ? data : [];
    },

    async assign(walkthroughId: string, actorId: string): Promise<any> {
        const { data } = await httpClient.post('/walkthrough-actors', { walkthroughId, actorId });
        return data;
    },

    async unassign(walkthroughId: string, actorId: string): Promise<void> {
        await httpClient.delete(`/walkthrough-actors/${actorId}`, {
            params: { walkthroughId }
        });
    },
};

