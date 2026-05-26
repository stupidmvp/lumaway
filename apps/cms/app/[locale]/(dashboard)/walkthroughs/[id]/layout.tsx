'use client';

import React, { use, useMemo, useRef, useState, useEffect } from 'react';
import type { ImperativePanelHandle } from "react-resizable-panels";
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ChevronLeft, ChevronRight, Info, Route, MessageCircle, Settings, Layers, PanelRight, SlidersHorizontal, MousePointer2, Component, Bot, Video, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations, useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { EditorProvider, useEditorContext } from '@/contexts/EditorContext';
import { EditorHeader } from '@/components/walkthrough-editor/EditorHeader';
import { WalkthroughTitleBlock } from '@/components/walkthrough-editor/WalkthroughTitleBlock';
import { UserAvatar } from '@/components/ui/user-avatar';
import VersionHistoryDrawer from '@/components/walkthrough-editor/VersionHistoryDrawer';
import { useCurrentUser } from '@luma/infra';

import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable';

import { EditorSidebar, type EditorSidebarTab } from '@/components/walkthrough-editor/EditorSidebar';

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
        selectedStepIndex,
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
        // Approval Workflow
        versionStatus,
        approvalRequired,
        approvalsCount,
        minApprovals,
        canRequestApproval,
        canApprove,
        canReject,
        requestApproval,
        approveVersion,
        rejectVersion,
        reviewerUserIds,
        approvals,
        handleTagsChange,
        handleParentChange,
        handlePreviousChange,
        handleNextChange,
        currentStep,
        updateStep,
        selectedStepIndex,
        handleObserverSessionChange,
        mediaLibraryExpanded,
        toggleMediaLibrary,
        generateGifs,
    } = useEditorContext();

    const totalSteps = localWalkthrough?.steps.length ?? 0;

    const mediaLibraryPanelRef = useRef<ImperativePanelHandle>(null);

    // Sync media library expansion state
    useEffect(() => {
        const panel = mediaLibraryPanelRef.current;
        if (!panel) return;
        if (mediaLibraryExpanded) {
            panel.expand();
        } else {
            panel.collapse();
        }
    }, [mediaLibraryExpanded]);

    const { data: user } = useCurrentUser();
    const currentUserId = user?.id;

    // ── Editor sidebar icon-tab state ──
    const [activeSidebarTab, setActiveSidebarTab] = useState<EditorSidebarTab>('properties');

    const handleSidebarTabClick = (tab: EditorSidebarTab) => {
        if (mediaLibraryExpanded && activeSidebarTab === tab) {
            // Same tab while open → collapse
            toggleMediaLibrary();
        } else {
            setActiveSidebarTab(tab);
            if (!mediaLibraryExpanded) toggleMediaLibrary();
        }
    };

    // ── Auto-open Properties tab when a step is selected ──
    useEffect(() => {
        if (selectedStepIndex >= 0) {
            setActiveSidebarTab('properties');
            if (!mediaLibraryExpanded) toggleMediaLibrary();
        }
    }, [selectedStepIndex]);

    // ── Active tab from pathname ──
    const activePageTab: TabKey = useMemo(() => {
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
        <TooltipProvider delayDuration={0}>
            <div className="flex h-full bg-background dark:bg-[#191919] font-sans transition-colors duration-300">


                {/* Main Workspace Area */}
                <div className="flex flex-1 flex-col overflow-hidden relative">
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
                        // Approval Workflow
                        approvalRequired={approvalRequired}
                        versionStatus={versionStatus}
                        approvalsCount={approvalsCount}
                        minApprovals={minApprovals}
                        canRequestApproval={canRequestApproval}
                        canApprove={canApprove}
                        canReject={canReject}
                        onRequestApproval={requestApproval}
                        onApprove={approveVersion}
                        onReject={rejectVersion}
                        reviewerUserIds={reviewerUserIds}
                        approvals={approvals}
                        projectId={localWalkthrough.projectId}
                        currentUserId={currentUserId}
                    />

                    <div className="flex-1 flex overflow-hidden">
                        {/* Fixed icon strip — always visible, outside ResizablePanel */}
                        <aside className="w-16 shrink-0 border-r border-border/40 bg-white/40 backdrop-blur-lg dark:bg-[#0f0f11]/30 flex flex-col overflow-hidden z-10">
                            <div className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-2">
                                {(
                                    [
                                        { id: 'properties', icon: SlidersHorizontal, label: 'Properties' },
                                        { id: 'lumens',     icon: Video,              label: 'Lumens'     },
                                        { id: 'media',      icon: ImageIcon,          label: 'Media'      },
                                    ] as { id: EditorSidebarTab; icon: React.ElementType; label: string }[]
                                ).map(({ id: tabId, icon: Icon, label }) => {
                                    const isActive = mediaLibraryExpanded && activeSidebarTab === tabId;
                                    return (
                                        <Tooltip key={tabId}>
                                            <TooltipTrigger asChild>
                                                <button
                                                    onClick={() => handleSidebarTabClick(tabId)}
                                                    className={cn(
                                                        'group flex items-center justify-center px-3 py-2.5 rounded-xl transition-all duration-300 w-full',
                                                        isActive
                                                            ? 'bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] dark:bg-background-secondary'
                                                            : 'hover:bg-background-secondary/40'
                                                    )}
                                                >
                                                    <Icon
                                                        className={cn(
                                                            'h-5 w-5 transition-all duration-300 shrink-0',
                                                            isActive
                                                                ? 'text-accent-blue scale-110 drop-shadow-[0_0_8px_rgba(59,130,246,0.2)]'
                                                                : 'text-foreground-muted/60 group-hover:text-foreground/80 group-hover:scale-105'
                                                        )}
                                                        strokeWidth={isActive ? 2.5 : 2}
                                                    />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="bg-foreground text-background border-none text-[12px] font-medium px-3 py-1.5 shadow-xl">
                                                {label}
                                            </TooltipContent>
                                        </Tooltip>
                                    );
                                })}
                            </div>
                        </aside>

                        <ResizablePanelGroup direction="horizontal" className="flex-1">
                            {/* Collapsible content panel */}
                            <ResizablePanel
                                ref={mediaLibraryPanelRef}
                                defaultSize={0}
                                minSize={28}
                                maxSize={42}
                                collapsible={true}
                                collapsedSize={0}
                                onCollapse={() => { if (mediaLibraryExpanded) toggleMediaLibrary(); }}
                                onExpand={() => { if (!mediaLibraryExpanded) toggleMediaLibrary(); }}
                            >
                                <EditorSidebar
                                    activeTab={activeSidebarTab}
                                    projectId={localWalkthrough.projectId}
                                    walkthroughId={id}
                                    id={id}
                                    localWalkthrough={localWalkthrough}
                                    canEdit={canEdit}
                                    handleTagsChange={handleTagsChange}
                                    handleParentChange={handleParentChange}
                                    handlePreviousChange={handlePreviousChange}
                                    handleNextChange={handleNextChange}
                                    currentStep={currentStep}
                                    selectedStepIndex={selectedStepIndex}
                                    updateStep={updateStep}
                                    linkedSessionId={localWalkthrough.observerSessionId}
                                    onSelectSession={handleObserverSessionChange}
                                    onGenerateGifs={async (sessionId) => {
                                        await handleObserverSessionChange(sessionId);
                                        await generateGifs();
                                    }}
                                />
                            </ResizablePanel>

                            <ResizableHandle withHandle={false} className="relative z-[100] w-px bg-border dark:bg-[#2d2d30] after:hidden">
                                {mediaLibraryExpanded && (
                                    <div
                                        className="absolute top-1/2 -translate-y-1/2 left-0 flex h-12 w-4 cursor-pointer items-center justify-center rounded-r-full bg-background-secondary dark:bg-[#111114] border border-l-0 border-border dark:border-[#2d2d30] shadow-[2px_0_8px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_8px_rgba(0,0,0,0.3)] text-foreground-muted hover:text-foreground dark:text-white/40 dark:hover:text-white hover:bg-background-secondary/80 dark:hover:bg-[#1a1a1e] transition-colors"
                                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleMediaLibrary(); }}
                                    >
                                        <ChevronLeft className="h-3 w-3 opacity-80 -ml-0.5" />
                                    </div>
                                )}
                            </ResizableHandle>

                            {/* Main content */}
                            <ResizablePanel defaultSize={100} minSize={40}>
                                <div className="h-full overflow-y-auto overflow-x-hidden bg-background dark:bg-[#191919] no-scrollbar">
                                    {children}
                                </div>
                            </ResizablePanel>

                        </ResizablePanelGroup>
                    </div>
                </div>

                {/* Version history drawer */}
                {showVersionHistory && (
                    <VersionHistoryDrawer
                        walkthroughId={id}
                        onClose={closeVersionHistory}
                    />
                )}
            </div>
        </TooltipProvider>
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

