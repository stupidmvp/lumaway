'use client';

import { useEditorContext } from '@/contexts/EditorContext';
import { CommentsPanel } from '@/components/comments';

export default function WalkthroughActivityPage() {
    const {
        id,
        localWalkthrough,
        canComment,
    } = useEditorContext();

    if (!localWalkthrough?.projectId) return null;

    return (
        <main className="flex-1 overflow-y-auto bg-background min-w-0">
            <div className="max-w-4xl mx-auto px-5 py-5 min-h-full flex flex-col">
                <CommentsPanel
                    projectId={localWalkthrough.projectId}
                    walkthroughId={id}
                    steps={localWalkthrough.steps.map((s) => ({ id: s.id, title: s.title }))}
                    canComment={canComment}
                    className="flex-1 min-h-0"
                />
            </div>
        </main>
    );
}

