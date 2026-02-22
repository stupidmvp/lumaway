import { httpClient } from '../http/client';

export interface WalkthroughVersion {
    id: string;
    walkthroughId: string;
    versionNumber: number;
    title: string;
    steps: any[];
    status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'published';
    isPublished: boolean;
    requestedApprovalAt?: string;
    approvedAt?: string;
    approvedBy?: string;
    rejectionReason?: string;
    createdBy?: string;
    createdAt: string;
    restoredFrom?: string;
    creator?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
}

export interface PaginatedVersions {
    data: WalkthroughVersion[];
    total: number;
    limit: number;
    skip: number;
}

export const WalkthroughVersionsService = {
    async getVersions(walkthroughId: string, limit: number = 5, skip: number = 0): Promise<PaginatedVersions> {
        const { data } = await httpClient.get<PaginatedVersions | WalkthroughVersion[]>(
            `/walkthrough-versions?walkthroughId=${walkthroughId}&$sort[createdAt]=-1&$limit=${limit}&$skip=${skip}`
        );
        // Handle both paginated and array responses
        if (Array.isArray(data)) {
            return { data, total: data.length, limit, skip };
        }
        return data;
    },

    async restoreVersion(walkthroughId: string, versionId: string): Promise<any> {
        const { data } = await httpClient.post(
            `/walkthrough-restore`,
            { walkthroughId, versionId }
        );
        return data;
    },

    async updateVersion(versionId: string, data: Partial<WalkthroughVersion>): Promise<WalkthroughVersion> {
        const { data: result } = await httpClient.patch<WalkthroughVersion>(
            `/walkthrough-versions/${versionId}`,
            data
        );
        return result;
    }
};
