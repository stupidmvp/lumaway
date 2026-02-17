'use client';

import { use } from 'react';
import { ActorsPanel } from '@/components/project-detail/ActorsPanel';
import { MainContent } from '@/components/shared/MainContent';
import { useTranslations } from 'next-intl';

export default function ProjectActorsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const t = useTranslations('Actors');

    return (
        <MainContent maxWidth="max-w-3xl">
            <p className="text-sm text-foreground-muted mb-6">{t('description')}</p>
            <ActorsPanel projectId={id} />
        </MainContent>
    );
}

