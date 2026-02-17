'use client';

import { use } from 'react';
import { WalkthroughsList } from '@/components/shared/WalkthroughsList';
import { MainContent } from '@/components/shared/MainContent';

export default function ProjectWalkthroughsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);

    return (
        <MainContent>
            <WalkthroughsList projectId={id} />
        </MainContent>
    );
}
