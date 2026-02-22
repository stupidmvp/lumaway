'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ENV } from '@/lib/env';
import { User, LogOut, Building2, Bell, CheckCheck, FolderKanban, MessageCircle, UserPlus, AtSign, ChevronDown, Settings, Mail, Calendar, Shield, AlertCircle, CheckCircle2, Megaphone, SmilePlus, ChevronRight, Languages, Sun, Moon, Monitor, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { useCurrentUser, AuthService, useNotifications, useUnreadNotificationsCount, useMarkNotificationAsRead, useMarkAllNotificationsAsRead, Notification as AppNotification, useActiveOrganization, useUpdatePreferences } from '@luma/infra';
import { useQueryClient } from '@tanstack/react-query';
import { Autocomplete } from '@/components/ui/autocomplete';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { useSidebar } from '@/components/ui/sidebar';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useTranslations, useLocale } from 'next-intl';
import { useTheme } from 'next-themes';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

function timeAgo(dateStr: string, t: any): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return t('justNow');
    if (diff < 3600) return t('minutesAgo', { count: Math.floor(diff / 60) });
    if (diff < 86400) return t('hoursAgo', { count: Math.floor(diff / 3600) });
    return t('daysAgo', { count: Math.floor(diff / 86400) });
}

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

export function TopBar() {
    const router = useRouter();
    const locale = useLocale();
    const t = useTranslations('TopBar');
    const tn = useTranslations('Notifications');
    const { data: currentUser } = useCurrentUser();
    const { activeOrg, organizations, switchOrganization, activeOrgId } = useActiveOrganization();
    const { state: sidebarState } = useSidebar();
    const isSidebarCollapsed = sidebarState === 'collapsed';

    // Notifications
    const { data: notificationsData } = useNotifications(20);
    const { data: unreadCount } = useUnreadNotificationsCount();
    const markAsRead = useMarkNotificationAsRead();
    const markAllAsRead = useMarkAllNotificationsAsRead();

    const notifications: AppNotification[] = notificationsData?.data || [];

    const queryClient = useQueryClient();
    const { theme, setTheme } = useTheme();
    const pathname = usePathname();
    const updatePreferences = useUpdatePreferences();

    const handleLogout = async () => {
        await AuthService.logout();
        queryClient.clear();
        router.push('/login');
    };

    const handleNotificationClick = async (notification: AppNotification) => {
        if (!notification.read) {
            await markAsRead.mutateAsync(notification.id);
        }

        const meta = notification.metadata;

        // Navigate based on type
        if (notification.type === 'project_invitation' && meta?.invitationToken) {
            router.push(`/invite/${meta.invitationToken}`);
        } else if (['mention', 'comment_reply', 'reaction', 'correction', 'comment_resolved', 'announcement', 'comment'].includes(notification.type)) {
            // Comment-related: navigate to the project/walkthrough and scroll to the comment
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

    const fullName = currentUser
        ? [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ') || t('user')
        : t('user');

    return (
        <header className="flex h-12 shrink-0 items-center border-b border-border bg-background z-50">
            {/* Left — Organization Switcher (matches sidebar width) */}
            <div
                className={cn(
                    "shrink-0 flex items-center h-full transition-[width] duration-200 ease-linear",
                    isSidebarCollapsed ? "w-[3rem] justify-center px-0" : "w-[16rem] px-2"
                )}
            >
                {isSidebarCollapsed ? (
                    /* Collapsed: show only org logo/icon */
                    (() => {
                        const logoSrc = activeOrg?.logo
                            ? activeOrg.logo.startsWith('http') ? activeOrg.logo : `${ENV.S3_URL_BASE}${activeOrg.logo}`
                            : null;
                        return logoSrc ? (
                            <Image
                                src={logoSrc}
                                alt={activeOrg?.name || ''}
                                width={24}
                                height={24}
                                className="h-6 w-6 rounded object-cover"
                            />
                        ) : (
                            <span className="h-6 w-6 rounded bg-accent-blue flex items-center justify-center">
                                <Building2 className="h-3 w-3 text-white" />
                            </span>
                        );
                    })()
                ) : (
                    <Autocomplete
                        value={activeOrgId ?? ''}
                        onValueChange={(value) => {
                            if (value && typeof value === 'string' && value !== activeOrgId) {
                                switchOrganization(value);
                                // Redirect to projects dashboard when switching organizations
                                router.push('/projects');
                            }
                        }}
                        service="organizations"
                        dataSource={organizations}
                        optionValue="id"
                        optionLabel="name"
                        renderOptionLabel={(item, open) => {
                            const logoSrc = item.logo
                                ? item.logo.startsWith('http') ? item.logo : `${ENV.S3_URL_BASE}${item.logo}`
                                : null;

                            return (
                                <span className="flex items-center gap-2 min-w-0">
                                    {logoSrc ? (
                                        <Image
                                            src={logoSrc}
                                            alt={item.name}
                                            width={open ? 18 : 20}
                                            height={open ? 18 : 20}
                                            className={cn(
                                                "rounded object-cover shrink-0",
                                                open ? "h-[18px] w-[18px]" : "h-5 w-5"
                                            )}
                                        />
                                    ) : (
                                        <span className={cn(
                                            "rounded bg-accent-blue flex items-center justify-center shrink-0",
                                            open ? "h-[18px] w-[18px]" : "h-5 w-5"
                                        )}>
                                            <Building2 className={cn("text-white", open ? "h-2.5 w-2.5" : "h-3 w-3")} />
                                        </span>
                                    )}
                                    <span className="truncate">
                                        <span className={cn(
                                            "text-sm",
                                            open ? "font-medium" : "font-semibold tracking-tight"
                                        )}>{item.name}</span>
                                    </span>
                                </span>
                            );
                        }}
                        allowClear={false}
                        placeholder={t('noOrganization')}
                        className="w-full"
                        triggerClassName="border-none shadow-none bg-transparent hover:bg-accent/50 h-9 px-2.5 gap-2 w-full"
                    />
                )}
            </div>

            {/* Right area — Actions */}
            <div className="flex-1 flex items-center gap-3 px-3 min-w-0 justify-end">

                <div className="flex items-center gap-1 shrink-0">
                    {/* Notification Bell */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className="relative p-2 rounded-md hover:bg-accent transition-colors cursor-pointer">
                                <Bell className="h-4 w-4 text-foreground-muted" />
                                {(unreadCount ?? 0) > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-accent-blue text-white text-[10px] font-bold flex items-center justify-center shadow-[0_0_6px_rgba(59,130,246,0.5)] leading-none">
                                        {(unreadCount ?? 0) > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </button>
                        </PopoverTrigger>
                        <PopoverContent
                            side="bottom"
                            align="end"
                            sideOffset={6}
                            className="w-80 p-0"
                        >
                            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                                <span className="text-sm font-semibold">{tn('title')}</span>
                                {(unreadCount ?? 0) > 0 && (
                                    <button
                                        onClick={() => markAllAsRead.mutate()}
                                        className="flex items-center gap-1 text-[11px] text-accent-blue hover:underline cursor-pointer"
                                    >
                                        <CheckCheck className="h-3 w-3" />
                                        {tn('markAllRead')}
                                    </button>
                                )}
                            </div>

                            <div className="max-h-[360px] overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-foreground-muted">
                                        <Bell className="h-8 w-8 opacity-20 mb-2" />
                                        <p className="text-sm font-medium">{tn('noNotifications')}</p>
                                        <p className="text-xs">{tn('noNotificationsDescription')}</p>
                                    </div>
                                ) : (
                                    notifications.map((notification) => {
                                        const Icon = NOTIFICATION_ICONS[notification.type] || Bell;
                                        return (
                                            <button
                                                key={notification.id}
                                                onClick={() => handleNotificationClick(notification)}
                                                className={cn(
                                                    "w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-accent/50 transition-colors cursor-pointer border-b border-border/50 last:border-b-0",
                                                    !notification.read && "bg-accent-blue/5"
                                                )}
                                            >
                                                <div className={cn(
                                                    "mt-0.5 h-7 w-7 rounded-full flex items-center justify-center shrink-0",
                                                    !notification.read ? "bg-accent-blue/10" : "bg-background-secondary"
                                                )}>
                                                    <Icon className={cn(
                                                        "h-3.5 w-3.5",
                                                        !notification.read ? "text-accent-blue" : "text-foreground-muted"
                                                    )} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={cn(
                                                        "text-xs leading-snug",
                                                        !notification.read ? "font-medium text-foreground" : "text-foreground-muted"
                                                    )}>
                                                        {notification.title}
                                                    </p>
                                                    {notification.body && (
                                                        <p className="text-[11px] text-foreground-muted mt-0.5 truncate">
                                                            {notification.body}
                                                        </p>
                                                    )}
                                                    <p className="text-[10px] text-foreground-muted/60 mt-1">
                                                        {timeAgo(notification.createdAt, tn)}
                                                    </p>
                                                </div>
                                                {!notification.read && (
                                                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent-blue shrink-0" />
                                                )}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                            <div className="p-2 border-t border-border bg-background-secondary/30">
                                <Link
                                    href="/inbox"
                                    className="flex items-center justify-center w-full py-1.5 text-xs font-semibold text-foreground-muted hover:text-accent-blue transition-colors gap-1.5"
                                >
                                    {tn('viewAll')}
                                    <ChevronRight className="h-3 w-3" />
                                </Link>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-2 rounded-md hover:bg-accent transition-colors px-2 py-1.5 cursor-pointer outline-none">
                                <UserAvatar
                                    firstName={currentUser?.firstName}
                                    lastName={currentUser?.lastName}
                                    avatar={currentUser?.avatar}
                                    size="xs"
                                    className="h-6 w-6"
                                />
                                <span className="text-[13px] font-medium text-foreground max-w-[140px] truncate hidden sm:inline">
                                    {fullName}
                                </span>
                                <ChevronDown className="h-3 w-3 text-foreground-muted shrink-0 hidden sm:block" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64">
                            {/* Profile Header */}
                            <div className="flex items-center gap-3 p-3">
                                <UserAvatar
                                    firstName={currentUser?.firstName}
                                    lastName={currentUser?.lastName}
                                    avatar={currentUser?.avatar}
                                    size="md"
                                    className="h-10 w-10 shrink-0"
                                />
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-semibold text-foreground truncate">
                                        {fullName}
                                    </span>
                                    {currentUser?.email && (
                                        <span className="text-xs text-foreground-muted truncate">
                                            {currentUser.email}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <DropdownMenuSeparator />

                            <div className="p-1">
                                <DropdownMenuItem asChild>
                                    <Link href="/profile" className="flex items-center gap-2.5 cursor-pointer">
                                        <User className="h-4 w-4 opacity-60" />
                                        <span>{t('myProfile')}</span>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href="/settings" className="flex items-center gap-2.5 cursor-pointer">
                                        <Settings className="h-4 w-4 opacity-60" />
                                        <span>{t('settings')}</span>
                                    </Link>
                                </DropdownMenuItem>
                            </div>

                            <DropdownMenuSeparator />

                            <div className="p-1">
                                {/* Appearance Submenu */}
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="gap-2.5 cursor-pointer">
                                        <Sun className="h-4 w-4 opacity-60" />
                                        <span>{t('appearance')}</span>
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                        <DropdownMenuItem
                                            onClick={async () => {
                                                setTheme('light');
                                                await updatePreferences.mutateAsync({ theme: 'light' });
                                            }}
                                            className="gap-2.5 cursor-pointer"
                                        >
                                            <Sun className="h-4 w-4 opacity-60" />
                                            <span>{t('lightMode')}</span>
                                            {theme === 'light' && <Check className="h-3.5 w-3.5 ml-auto text-accent-blue" />}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={async () => {
                                                setTheme('dark');
                                                await updatePreferences.mutateAsync({ theme: 'dark' });
                                            }}
                                            className="gap-2.5 cursor-pointer"
                                        >
                                            <Moon className="h-4 w-4 opacity-60" />
                                            <span>{t('darkMode')}</span>
                                            {theme === 'dark' && <Check className="h-3.5 w-3.5 ml-auto text-accent-blue" />}
                                        </DropdownMenuItem>
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>

                                {/* Language Submenu */}
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="gap-2.5 cursor-pointer">
                                        <Languages className="h-4 w-4 opacity-60" />
                                        <span>{t('language')}</span>
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                        {[
                                            { code: 'en', label: t('english') },
                                            { code: 'es', label: t('spanish') }
                                        ].map((loc) => (
                                            <DropdownMenuItem
                                                key={loc.code}
                                                onClick={async () => {
                                                    const segments = pathname.split('/');
                                                    const localePrefixes = ['en', 'es'];
                                                    const hasLocale = segments[1] && localePrefixes.includes(segments[1] as string);

                                                    if (hasLocale) {
                                                        segments[1] = loc.code;
                                                    } else {
                                                        segments.splice(1, 0, loc.code);
                                                    }

                                                    const newPath = segments.join('/') || '/';
                                                    await updatePreferences.mutateAsync({ language: loc.code as 'en' | 'es' });
                                                    router.push(newPath);
                                                }}
                                                className="gap-2.5 cursor-pointer"
                                            >
                                                <span className="uppercase text-[10px] font-bold w-4 text-center opacity-60">
                                                    {loc.code}
                                                </span>
                                                <span>{loc.label}</span>
                                                {locale === loc.code && <Check className="h-3.5 w-3.5 ml-auto text-accent-blue" />}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                            </div>

                            <DropdownMenuSeparator />

                            <div className="p-1">
                                <DropdownMenuItem
                                    onClick={handleLogout}
                                    className="gap-2.5 text-destructive focus:text-destructive cursor-pointer"
                                >
                                    <LogOut className="h-4 w-4 opacity-60" />
                                    <span>{t('logOut')}</span>
                                </DropdownMenuItem>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    );
}
