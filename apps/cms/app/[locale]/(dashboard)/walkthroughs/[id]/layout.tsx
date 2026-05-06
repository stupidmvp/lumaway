'use client';

import React, { use, useMemo, useRef, useState, useEffect } from 'react';
import type { ImperativePanelHandle } from "react-resizable-panels";
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Info, Route, MessageCircle, Settings, Layers, PanelRight, ChevronLeft, ChevronRight, SlidersHorizontal, MousePointer2, Component, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

// Properties Panel Components
import { WalkthroughProperties } from '@/components/walkthrough-editor/WalkthroughProperties';
import { ActorAssignment } from '@/components/walkthrough-editor/ActorAssignment';
import { WalkthroughFlowSection } from '@/components/walkthrough-editor/WalkthroughFlowSection';
import { StepPropertiesSidebar } from '@/components/walkthrough-editor/StepPropertiesSidebar';

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
    } = useEditorContext();

    const totalSteps = localWalkthrough?.steps.length ?? 0;

    const [isPropertiesCollapsed, setIsPropertiesCollapsed] = useState(false);
    const propertiesPanelRef = useRef<ImperativePanelHandle>(null);

    const { data: user } = useCurrentUser();
    const currentUserId = user?.id;

    // ── Active tab from pathname ──
    const activePageTab: TabKey = useMemo(() => {
        if (pathname.endsWith('/steps')) return 'steps';
        if (pathname.endsWith('/activity')) return 'activity';
        return 'general';
    }, [pathname]);

    const [activePropertiesTab, setActivePropertiesTab] = useState('configuration');

    // Auto-switch to "step" tab when a step is selected
    useEffect(() => {
        if (selectedStepIndex >= 0) {
            setActivePropertiesTab('step');
        }
    }, [selectedStepIndex]);

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
            <div className="flex h-full bg-background font-sans transition-colors duration-300">
                {/* Slim Icon Sidebar — Left */}
                <aside className="w-[68px] border-r border-border bg-[#f9fafb] dark:bg-[#09090b] flex flex-col shrink-0 py-4 gap-2 items-center z-50">
                    {/* App Logo */}
                    <div className="mb-6">
                        <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center text-accent-blue">
                            <Route className="h-5 w-5" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 w-full px-2">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activePageTab === tab.key;

                            return (
                                <Tooltip key={tab.key}>
                                    <TooltipTrigger asChild>
                                        <Link
                                            href={tab.href}
                                            className={cn(
                                                'relative flex items-center justify-center h-12 w-full rounded-xl transition-all duration-200 group',
                                                isActive
                                                    ? 'bg-accent-blue text-white shadow-[0_4px_12px_rgba(59,130,246,0.3)]'
                                                    : 'text-foreground-muted hover:text-foreground hover:bg-background-secondary'
                                            )}
                                        >
                                            <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-white" : "text-foreground-muted group-hover:text-foreground")} />
                                            
                                            {/* Badge */}
                                            {!!tab.badge && tab.badge > 0 && (
                                                <span className="absolute top-2 right-2 h-4 min-w-[16px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-background shadow-sm">
                                                    {tab.badge}
                                                </span>
                                            )}
                                        </Link>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="bg-foreground text-background border-none text-[12px] font-medium px-3 py-1.5">
                                        {tab.label}
                                    </TooltipContent>
                                </Tooltip>
                            );
                        })}
                    </div>

                    <div className="mt-auto flex flex-col gap-2 w-full px-2">
                         <Tooltip>
                            <TooltipTrigger asChild>
                                <button className="flex items-center justify-center h-12 w-full rounded-xl text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-all">
                                    <Settings className="h-5 w-5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="bg-foreground text-background border-none text-[12px] font-medium px-3 py-1.5">
                                {t('settings') || 'Settings'}
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </aside>

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
                        <ResizablePanelGroup direction="horizontal">
                            {/* Center Content (Scrollable) */}
                            <ResizablePanel defaultSize={75} minSize={40}>
                                <div className="h-full overflow-y-auto bg-background custom-scrollbar">
                                    {children}
                                </div>
                            </ResizablePanel>

                            <ResizableHandle className="w-[1.5px] bg-border/40 hover:bg-accent-blue/40 transition-colors relative">
                                <div
                                    className="absolute top-1/2 -translate-y-1/2 right-0 z-50 flex h-12 w-4 cursor-pointer items-center justify-center rounded-l-full bg-white dark:bg-[#09090b] border border-r-0 border-border shadow-[-2px_0_8px_rgba(0,0,0,0.05)] text-foreground-muted/40 hover:text-accent-blue hover:bg-background-secondary transition-all group"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        const panel = propertiesPanelRef.current;
                                        if (panel) {
                                            if (panel.isCollapsed()) {
                                                panel.expand();
                                            } else {
                                                panel.collapse();
                                            }
                                        }
                                    }}
                                >
                                    {isPropertiesCollapsed ? (
                                        <ChevronLeft className="h-3 w-3 transition-transform group-hover:scale-110" />
                                    ) : (
                                        <ChevronRight className="h-3 w-3 transition-transform group-hover:scale-110" />
                                    )}
                                </div>
                            </ResizableHandle>

                            {/* Right Properties Panel */}
                            <ResizablePanel 
                                ref={propertiesPanelRef}
                                defaultSize={25} 
                                minSize={20} 
                                maxSize={40}
                                collapsible={true}
                                collapsedSize={0}
                                onCollapse={() => setIsPropertiesCollapsed(true)}
                                onExpand={() => setIsPropertiesCollapsed(false)}
                                className={cn(
                                    "transition-all duration-300 ease-in-out border-l border-border/60",
                                    isPropertiesCollapsed ? "min-w-[0px] border-l-0" : ""
                                )}
                            >
                                <aside className="h-full bg-background flex flex-col overflow-hidden z-40">
                                    <Tabs value={activePropertiesTab} onValueChange={setActivePropertiesTab} className="flex-1 flex-col overflow-hidden">
                                        <div className="h-14 px-4 border-b border-border flex items-center justify-between bg-background shrink-0">
                                            <TabsList className="flex h-full w-auto justify-start gap-6 bg-transparent p-0 rounded-none border-none">
                                                <TabsTrigger 
                                                    value="configuration"
                                                    className="relative h-full rounded-none border-b-2 border-transparent data-[state=active]:border-accent-blue data-[state=active]:text-accent-blue data-[state=active]:bg-transparent text-[13px] font-semibold px-1 transition-all gap-2"
                                                >
                                                    <SlidersHorizontal className="h-4 w-4" />
                                                    {t('configuration') || 'Configuration'}
                                                </TabsTrigger>
                                                <TabsTrigger 
                                                    value="step"
                                                    className="relative h-full rounded-none border-b-2 border-transparent data-[state=active]:border-accent-blue data-[state=active]:text-accent-blue data-[state=active]:bg-transparent text-[13px] font-semibold px-1 transition-all gap-2"
                                                >
                                                    <MousePointer2 className="h-4 w-4" />
                                                    {t('step') || 'Step Properties'}
                                                </TabsTrigger>
                                            </TabsList>
                                            
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                    <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8 text-foreground-muted/40 hover:text-foreground-muted"
                                                            onClick={() => propertiesPanelRef.current?.collapse()}
                                                        >
                                                            <PanelRight className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="bottom" className="text-[11px]">
                                                        Hide panel
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                        
                                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                                            <TabsContent value="configuration" className="m-0 focus-visible:outline-none">
                                                <div className="p-0 space-y-0 divide-y divide-border/40">
                                                    {/* Page Info Section */}
                                                    <section className="p-6 space-y-6">
                                                        <div className="flex items-center gap-2 text-foreground/80">
                                                            <Info className="h-3.5 w-3.5 text-accent-blue" />
                                                            <h3 className="text-[11px] font-bold uppercase tracking-[0.08em]">Document Settings</h3>
                                                        </div>
                                                        <div className="space-y-5 px-1">
                                                            <WalkthroughProperties
                                                                tags={localWalkthrough.tags ?? []}
                                                                canEdit={canEdit}
                                                                onTagsChange={handleTagsChange}
                                                            />

                                                            <ActorAssignment
                                                                walkthroughId={id}
                                                                projectId={localWalkthrough.projectId}
                                                                canEdit={canEdit}
                                                            />
                                                        </div>
                                                    </section>

                                                    {/* Navigation Flow Section */}
                                                    <section className="p-6 space-y-6">
                                                        <div className="flex items-center gap-2 text-foreground/80">
                                                            <Route className="h-3.5 w-3.5 text-foreground-muted" />
                                                            <h3 className="text-[11px] font-bold uppercase tracking-[0.08em]">Workflow & Logic</h3>
                                                        </div>
                                                        <div className="space-y-5 px-1">
                                                            <WalkthroughFlowSection
                                                                walkthroughId={id}
                                                                projectId={localWalkthrough.projectId}
                                                                parentId={localWalkthrough.parentId}
                                                                previousWalkthroughId={localWalkthrough.previousWalkthroughId}
                                                                nextWalkthroughId={localWalkthrough.nextWalkthroughId}
                                                                onParentChange={handleParentChange}
                                                                onPreviousChange={handlePreviousChange}
                                                                onNextChange={handleNextChange}
                                                            />
                                                        </div>
                                                    </section>

                                                    {/* Contextual help or info */}
                                                    <div className="p-6">
                                                        <div className="p-5 rounded-2xl bg-accent-blue/5 border border-accent-blue/10 shadow-[0_4px_12px_rgba(var(--accent-blue-rgb),0.03)]">
                                                            <div className="flex items-start gap-3">
                                                                <div className="w-6 h-6 rounded-full bg-accent-blue/20 flex items-center justify-center shrink-0">
                                                                    <Info className="h-3.5 w-3.5 text-accent-blue" />
                                                                </div>
                                                                <p className="text-[12px] text-foreground-muted/80 leading-relaxed font-medium">
                                                                    These properties define how this walkthrough is categorized and how it relates to other documentation in the project.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </TabsContent>

                                            <TabsContent value="step" className="m-0 focus-visible:outline-none">
                                                <StepPropertiesSidebar 
                                                    step={currentStep}
                                                    stepIndex={selectedStepIndex}
                                                    projectId={localWalkthrough.projectId}
                                                    canEdit={canEdit}
                                                    onUpdateStep={updateStep}
                                                />
                                            </TabsContent>
                                        </div>
                                    </Tabs>
                                </aside>
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

