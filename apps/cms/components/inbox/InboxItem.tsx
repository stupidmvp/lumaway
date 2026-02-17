'use client';

import { Bell, UserPlus, FolderKanban, MessageCircle, AtSign, SmilePlus, AlertCircle, CheckCircle2, Megaphone } from 'lucide-react';
import { Notification as AppNotification, useMarkNotificationAsRead } from '@luma/infra';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

const NOTIFICATION_ICONS: Record<string, React.ElementType> = {
    project_invitation: UserPlus,
    invitation_accepted: FolderKanban,
    comment: MessageCircle,
    mention: AtSign,
    comment_reply: MessageCircle,
    reaction: SmilePlus,
    correction: AlertCircle,
    comment_resolved: CheckCircle2,
    announcement: Megaphone,
};

function timeAgo(dateStr: string, t: any): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return t('justNow');
    if (diff < 3600) return t('minutesAgo', { count: Math.floor(diff / 60) });
    if (diff < 86400) return t('hoursAgo', { count: Math.floor(diff / 3600) });
    return t('daysAgo', { count: Math.floor(diff / 86400) });
}

interface InboxItemProps {
    notification: AppNotification;
}

export function InboxItem({ notification }: InboxItemProps) {
    const router = useRouter();
    const t = useTranslations('Notifications');
    const markAsRead = useMarkNotificationAsRead();

    const Icon = NOTIFICATION_ICONS[notification.type] || Bell;

    const handleClick = async () => {
        if (!notification.read) {
            await markAsRead.mutateAsync(notification.id);
        }

        const meta = notification.metadata;

        if (notification.type === 'project_invitation' && meta?.invitationToken) {
            router.push(`/invite/${meta.invitationToken}`);
        } else if (['mention', 'comment_reply', 'reaction', 'correction', 'comment_resolved', 'announcement', 'comment'].includes(notification.type)) {
            const commentId = meta?.commentId || '';
            if (meta?.walkthroughId) {
                router.push(`/walkthroughs/${meta.walkthroughId}/activity${commentId ? `?commentId=${commentId}` : ''}`);
            } else if (meta?.projectId) {
                router.push(`/projects/${meta.projectId}/activity${commentId ? `?commentId=${commentId}` : ''}`);
            }
        } else if (meta?.projectId) {
            router.push(`/projects/${meta.projectId}`);
        }
    };

    return (
        <div
            onClick={handleClick}
            className={cn(
                "group relative flex items-start gap-4 p-4 transition-all border-b border-border/50 hover:bg-accent/30 cursor-pointer",
                !notification.read && "bg-accent-blue/[0.03]"
            )}
        >
            <div className={cn(
                "mt-0.5 h-10 w-10 rounded-full flex items-center justify-center shrink-0 border border-border/50 transition-colors",
                !notification.read ? "bg-accent-blue/10 border-accent-blue/20" : "bg-background-secondary"
            )}>
                <Icon className={cn(
                    "h-5 w-5",
                    !notification.read ? "text-accent-blue" : "text-foreground-muted"
                )} />
            </div>

            <div className="flex-1 min-w-0 pr-8">
                <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                        "text-sm tracking-tight",
                        !notification.read ? "font-semibold text-foreground" : "font-medium text-foreground-muted"
                    )}>
                        {notification.title}
                    </span>
                    {!notification.read && (
                        <span className="h-1.5 w-1.5 rounded-full bg-accent-blue shrink-0 animate-pulse" />
                    )}
                </div>

                {notification.body && (
                    <p className={cn(
                        "text-[13px] leading-relaxed mb-1.5 line-clamp-2",
                        !notification.read ? "text-foreground/80" : "text-foreground-muted/80"
                    )}>
                        {notification.body}
                    </p>
                )}

                <span className="text-[11px] text-foreground-muted/60 font-medium tracking-wide flex items-center gap-1.5">
                    {timeAgo(notification.createdAt, t)}
                    {notification.read && (
                        <>
                            <span>•</span>
                            <span className="opacity-70">{t('read')}</span>
                        </>
                    )}
                </span>
            </div>

            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                {!notification.read && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            markAsRead.mutate(notification.id);
                        }}
                        className="text-[11px] font-semibold text-accent-blue hover:text-accent-blue/80 px-2 py-1 rounded hover:bg-accent-blue/10 transition-colors"
                    >
                        {t('markAsRead')}
                    </button>
                )}
            </div>
        </div>
    );
}
