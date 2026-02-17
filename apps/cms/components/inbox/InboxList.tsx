'use client';

import { useState } from 'react';
import { useNotifications, Notification as AppNotification } from '@luma/infra';
import { InboxItem } from './InboxItem';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Inbox } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';

export function InboxList() {
    const t = useTranslations('Notifications');
    const [filter, setFilter] = useState<'all' | 'unread'>('all');

    // Fetch a generous amount for the inbox view
    const { data: notificationsData, isLoading } = useNotifications(50);
    const notifications: AppNotification[] = notificationsData?.data || [];

    const filteredNotifications = notifications.filter(n => {
        if (filter === 'unread') return !n.read;
        return true;
    });

    if (isLoading) {
        return (
            <div className="divide-y divide-border/50">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="p-4 flex gap-4">
                        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-1/4" />
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/6" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background rounded-xl border border-border/60 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-background/50 backdrop-blur-sm sticky top-0 z-10">
                <Tabs value={filter} onValueChange={(val: string) => setFilter(val as 'all' | 'unread')} className="w-auto">
                    <TabsList className="bg-background-secondary/50 p-0.5 h-8 border border-border/40">
                        <TabsTrigger
                            value="all"
                            className="text-xs h-7 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                        >
                            {t('all')}
                        </TabsTrigger>
                        <TabsTrigger
                            value="unread"
                            className="text-xs h-7 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                        >
                            {t('unread')}
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <span className="text-xs font-medium text-foreground-muted bg-background-secondary px-2.5 py-1 rounded-full border border-border/40">
                    {filteredNotifications.length} {filter === 'unread' ? t('unread').toLowerCase() : t('all').toLowerCase()}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto">
                {filteredNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
                        <div className="h-16 w-16 rounded-2xl bg-background-secondary/50 flex items-center justify-center mb-4 border border-border/40">
                            {filter === 'unread' ? (
                                <Bell className="h-8 w-8 text-foreground-muted/20" />
                            ) : (
                                <Inbox className="h-8 w-8 text-foreground-muted/20" />
                            )}
                        </div>
                        <h3 className="text-base font-semibold text-foreground mb-1">
                            {filter === 'unread' ? t('noUnreadTitle') : t('emptyTitle')}
                        </h3>
                        <p className="text-sm text-foreground-muted max-w-[280px]">
                            {filter === 'unread' ? t('noUnreadDescription') : t('emptyDescription')}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-border/40">
                        {filteredNotifications.map((notification) => (
                            <InboxItem key={notification.id} notification={notification} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
