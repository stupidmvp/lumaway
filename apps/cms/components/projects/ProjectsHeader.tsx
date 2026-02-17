'use client';

import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { CreateProjectDialog } from '@/components/shared/CreateProjectDialog';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePermissions } from '@luma/infra';

export function ProjectsHeader() {
    const [createOpen, setCreateOpen] = useState(false);
    const t = useTranslations('Projects');
    const permissions = usePermissions();
    const canCreateProjects = permissions.can('create', 'projects');

    return (
        <>
            <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
            <header className="h-14 bg-background border-b border-border flex justify-between items-center px-4 shadow-sm z-20 shrink-0 sticky top-0">
                <div className="flex items-center gap-4">
                    <h1 className="text-lg font-semibold text-foreground">{t('title')}</h1>
                </div>

                {canCreateProjects && (
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={() => setCreateOpen(true)}
                            className="h-9 px-4 gap-2 bg-accent-blue hover:bg-accent-blue/90 text-white shadow-sm cursor-pointer"
                        >
                            <Plus className="h-4 w-4" />
                            <span className="text-sm font-medium">{t('newProject')}</span>
                        </Button>
                    </div>
                )}
            </header>
        </>
    );
}
