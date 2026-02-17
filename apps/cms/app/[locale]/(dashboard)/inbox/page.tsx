'use client';

import { useTranslations } from 'next-intl';
import { InboxList } from '@/components/inbox/InboxList';
import { CheckCheck } from 'lucide-react';
import { useMarkAllNotificationsAsRead, useUnreadNotificationsCount } from '@luma/infra';
import { Button } from '@/components/ui/button';

export default function InboxPage() {
    const t = useTranslations('Notifications');
    const { data: unreadCount } = useUnreadNotificationsCount();
    const markAllAsRead = useMarkAllNotificationsAsRead();

    const handleMarkAllRead = () => {
        markAllAsRead.mutate();
    };

    return (
        <div className="flex flex-col h-[calc(100vh-3rem)] max-w-5xl mx-auto w-full px-4 py-6 md:px-8 md:py-8 gap-6 overflow-hidden">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 px-2">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                        {t('inboxTitle')}
                    </h1>
                    <p className="text-sm text-foreground-muted font-medium">
                        {unreadCount ? t('noNotifications') : t('noNotificationsDescription')}
                        {/* We use the simple translation keys but the context is richer now */}
                    </p>
                </div>

                {(unreadCount ?? 0) > 0 && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleMarkAllRead}
                        className="h-9 px-4 flex items-center gap-2 border-border/60 hover:bg-accent/50 hover:text-accent-blue transition-all"
                    >
                        <CheckCheck className="h-4 w-4" />
                        <span className="text-xs font-semibold">{t('markAllRead')}</span>
                    </Button>
                )}
            </header>

            <main className="flex-1 min-h-0">
                <InboxList />
            </main>
        </div>
    );
}
