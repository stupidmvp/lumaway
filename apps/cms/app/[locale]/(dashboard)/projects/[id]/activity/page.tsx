'use client';

import { use } from 'react';
import { useProjectSettingsPermissions } from '@luma/infra';
import { CommentsPanel } from '@/components/comments';
import { MainContent } from '@/components/shared/MainContent';

export default function ProjectActivityPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { canComment } = useProjectSettingsPermissions(id);

    return (
        <MainContent fill maxWidth="max-w-5xl">
            <CommentsPanel
                projectId={id}
                canComment={canComment}
                showHeader={false}
                className="flex-1 min-h-0"
            />
        </MainContent>
    );
}
