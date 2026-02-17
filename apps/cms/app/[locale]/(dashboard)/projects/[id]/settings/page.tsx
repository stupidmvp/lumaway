'use client';

import { use } from 'react';
import { ProjectSettingsPanel } from '@/components/project-detail/ProjectSettingsPanel';

export default function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);

    return <ProjectSettingsPanel projectId={id} className="flex-1 min-h-0" />;
}
