'use client';

import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { CreateWalkthroughModal } from '@/components/modals/CreateWalkthroughModal';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { useTranslations } from 'next-intl';
import { usePermissions } from '@luma/infra';

export function WalkthroughsHeader() {
    const [createOpen, setCreateOpen] = useState(false);
    const t = useTranslations('Walkthroughs');
    const permissions = usePermissions();
    const canCreateWalkthroughs = permissions.can('create', 'walkthroughs');

    return (
        <>
            <CreateWalkthroughModal open={createOpen} onOpenChange={setCreateOpen} />
            <header className="h-14 bg-background border-b border-border flex justify-between items-center px-4 shadow-sm z-20 shrink-0 sticky top-0">
                <div className="flex items-center gap-4">
                    <Breadcrumb />
                </div>

                {canCreateWalkthroughs && (
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={() => setCreateOpen(true)}
                            className="h-9 px-4 gap-2 bg-accent-blue hover:bg-accent-blue/90 text-white shadow-sm cursor-pointer"
                        >
                            <Plus className="h-4 w-4" />
                            <span className="text-sm font-medium">{t('newWalkthrough')}</span>
                        </Button>
                    </div>
                )}
            </header>
        </>
    );
}
