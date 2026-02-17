'use client';

import { use, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    Loader2,
    Info,
    Route,
    MessageCircle,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import { EditorProvider, useEditorContext } from '@/contexts/EditorContext';
import { EditorHeader } from '@/components/walkthrough-editor/EditorHeader';
import { WalkthroughTitleBlock } from '@/components/walkthrough-editor/WalkthroughTitleBlock';
import { UserAvatar } from '@/components/ui/user-avatar';
import VersionHistoryDrawer from '@/components/walkthrough-editor/VersionHistoryDrawer';

/* ─── Tab types ─── */

type TabKey = 'general' | 'steps' | 'activity';

interface TabDef {
    key: TabKey;
    href: string;
    icon: React.ElementType;
    label: string;
    badge?: number;
    badgeColor?: 'blue' | 'amber' | 'muted';
}

/* ─── Metadata bar ─── */

const ROLE_LABELS: Record<string, string> = {
    owner: 'author',
    admin: 'admin',
    editor: 'editor',
    viewer: 'viewer',
};

function MetadataBar() {
    const {
        localWalkthrough,
        effectiveRole,
        versions,
    } = useEditorContext();
    const tc = useTranslations('Common');
    const tm = useTranslations('Members');
    const locale = useLocale();

    if (!localWalkthrough) return null;

    const latestVersion = versions.length > 0 ? versions[0]! : null;
    const creatorName = latestVersion?.creator
        ? `${latestVersion.creator.firstName} ${latestVersion.creator.lastName}`.trim()
        : null;
    const formattedDate = localWalkthrough.updatedAt
        ? new Intl.DateTimeFormat(locale, {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(localWalkthrough.updatedAt))
        : null;

    const roleLabelKey = effectiveRole ? ROLE_LABELS[effectiveRole] : null;
    const roleText = roleLabelKey
        ? effectiveRole === 'owner'
            ? tc('author')
            : tm(roleLabelKey)
        : null;

    return (
        <div className="flex items-center gap-2 flex-wrap text-xs text-foreground-muted">
            {/* Status */}
            <span className="inline-flex items-center gap-1.5">
                <span
                    className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        localWalkthrough.isPublished
                            ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.3)]'
                            : 'bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.3)]'
                    )}
                />
                <span className="text-foreground-subtle">
                    {localWalkthrough.isPublished ? tc('published') : tc('draft')}
                </span>
            </span>

            {/* Role */}
            {roleText && (
                <>
                    <span className="text-foreground-muted/30">·</span>
                    <span className="text-foreground-subtle">{roleText}</span>
                </>
            )}

            {/* Version + author + date */}
            {latestVersion && (
                <>
                    <span className="text-foreground-muted/30">·</span>
                    <span className="inline-flex items-center gap-1.5">
                        {latestVersion.creator && (
                            <UserAvatar
                                firstName={latestVersion.creator.firstName}
                                lastName={latestVersion.creator.lastName}
                                size="xs"
                                className="h-4 w-4"
                                userInfo={{ email: latestVersion.creator.email }}
                            />
                        )}
                        <span>
                            v{latestVersion.versionNumber}
                            {creatorName && ` · ${creatorName}`}
                            {formattedDate && ` · ${formattedDate}`}
                        </span>
                    </span>
                </>
            )}
        </div>
    );
}

/* ─── Inner layout (consumes context) ─── */

function WalkthroughLayoutInner({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const t = useTranslations('Editor');

    const {
        id,
        localWalkthrough,
        versions,
        isLoading,
        isError,
        canEdit,
        canPublish,
        isPending,
        showVersionHistory,
        handleTitleChange,
        handleDescriptionChange,
        handleSave,
        togglePublish,
        openVersionHistory,
        closeVersionHistory,
    } = useEditorContext();

    // ── Active tab from pathname ──
    const activeTab: TabKey = useMemo(() => {
        if (pathname.endsWith('/steps')) return 'steps';
        if (pathname.endsWith('/activity')) return 'activity';
        return 'general';
    }, [pathname]);

    // ── Tab definitions ──
    const tabs: TabDef[] = useMemo(() => [
        {
            key: 'general',
            href: `/walkthroughs/${id}`,
            icon: Info,
            label: t('tabGeneral'),
        },
        {
            key: 'steps',
            href: `/walkthroughs/${id}/steps`,
            icon: Route,
            label: t('tabSteps'),
            badge: localWalkthrough?.steps.length || 0,
            badgeColor: 'muted',
        },
        {
            key: 'activity',
            href: `/walkthroughs/${id}/activity`,
            icon: MessageCircle,
            label: t('tabActivity'),
        },
    ], [id, t, localWalkthrough?.steps.length]);

    const badgeColorMap = {
        blue: 'bg-accent-blue/10 text-accent-blue',
        amber: 'bg-amber-500/10 text-amber-500',
        muted: 'bg-foreground-muted/10 text-foreground-muted',
    };

    // ── Loading / Error states ──

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
            </div>
        );
    }

    if (isError || !localWalkthrough) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-foreground-muted text-sm">{t('failedToLoad')}</p>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col bg-background font-sans transition-colors duration-300">
            {/* Top header bar — breadcrumb, version history, publish, save */}
            <EditorHeader
                hasVersions={versions.length > 0}
                onOpenVersionHistory={openVersionHistory}
                canEdit={canEdit}
                canPublish={canPublish}
                isPublished={localWalkthrough.isPublished}
                isPending={isPending}
                parentId={localWalkthrough.parentId}
                onTogglePublish={togglePublish}
                onSave={handleSave}
            />

            {/* Title + metadata + tabs */}
            <div className="px-5 sm:px-6 pt-4 bg-background-secondary dark:bg-background shrink-0">
                <div className="w-full">
                    {/* Metadata bar */}
                    <MetadataBar />

                    {/* Title + Description */}
                    <WalkthroughTitleBlock
                        title={localWalkthrough.title}
                        description={localWalkthrough.description ?? null}
                        canEdit={canEdit}
                        onTitleChange={handleTitleChange}
                        onDescriptionChange={handleDescriptionChange}
                    />

                    {/* Tabs */}
                    <div className="flex items-center gap-1 border-b border-border mt-1">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.key;

                            return (
                                <Link
                                    key={tab.key}
                                    href={tab.href}
                                    className={cn(
                                        'relative px-4 py-2.5 text-sm font-medium transition-colors',
                                        isActive
                                            ? 'text-foreground'
                                            : 'text-foreground-muted hover:text-foreground',
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <Icon className="h-4 w-4" />
                                        {tab.label}
                                        {!!tab.badge && tab.badge > 0 && (
                                            <span
                                                className={cn(
                                                    'h-5 min-w-[20px] px-1.5 text-[10px] font-bold rounded-full flex items-center justify-center',
                                                    badgeColorMap[tab.badgeColor || 'muted'],
                                                )}
                                            >
                                                {tab.badge}
                                            </span>
                                        )}
                                    </div>
                                    {isActive && (
                                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue rounded-t" />
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Tab content — fills remaining space */}
            {children}

            {/* Version history drawer */}
            {showVersionHistory && (
                <VersionHistoryDrawer
                    walkthroughId={id}
                    onClose={closeVersionHistory}
                />
            )}
        </div>
    );
}

/* ─── Outer layout (provides context) ─── */

export default function WalkthroughLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);

    return (
        <EditorProvider id={id}>
            <WalkthroughLayoutInner>{children}</WalkthroughLayoutInner>
        </EditorProvider>
    );
}

