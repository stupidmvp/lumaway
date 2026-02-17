import { httpClient } from '../http/client';

export interface S3SignUrlRequest {
    type: string;
    filename: string;
    path?: string;
    bucket?: string;
}

export interface S3SignUrlResponse {
    signedUrl: string;
    s3Path: string;
    s3PathWithoutBucket: string;
    headers: {
        'Content-Type': string;
    };
}

export const S3UrlSigningService = {
    async create(params: S3SignUrlRequest): Promise<S3SignUrlResponse> {
        const { data } = await httpClient.post<S3SignUrlResponse>('/s3-url-signing', params);
        return data;
    },
};


