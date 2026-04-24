'use client';

import { use } from 'react';
import { LumenReviewPanel } from '@/components/project-detail/LumenReviewPanel';

export default function LumenReviewInLumensPage({
    params,
}: {
    params: Promise<{ id: string; lumenId: string }>;
}) {
    const { id, lumenId } = use(params);
    return <LumenReviewPanel projectId={id} lumenId={lumenId} />;
}

