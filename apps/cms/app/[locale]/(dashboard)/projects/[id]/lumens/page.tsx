'use client';

import { use } from 'react';
import { ProjectLumensPanel } from '@/components/project-detail/ProjectLumensPanel';

export default function ProjectLumensPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    return <ProjectLumensPanel projectId={id} />;
}

