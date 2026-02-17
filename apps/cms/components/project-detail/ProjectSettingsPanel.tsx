'use client';

import { useCallback, useMemo, useState } from 'react';
import { useProject, useUpdateProject, useUpdateProjectSettings, DEFAULT_PROJECT_SETTINGS, type ProjectSettings } from '@luma/infra';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Loader2,
    Globe,
    Shield,
    Users,
    Bell,
    Bot,
    Save,
    Settings,
    ImageIcon,
    FolderKanban,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { SettingsSidebar, type SettingsTabDef } from '@/components/shared/SettingsSidebar';
import { FileUpload, type FileWithProgress } from '@/components/ui/file-upload';
import { ENV } from '@/lib/env';
import Image from 'next/image';

// ── Tab type ─────────────────────────────────────────────────────────────

type ProjectSettingsTab = 'general' | 'assistant' | 'security' | 'permissions' | 'notifications';

// ── Helpers ──────────────────────────────────────────────────────────────

function SettingRow({
    label,
    description,
    children,
}: {
    label: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between gap-6 py-3.5 border-b border-border/50 last:border-b-0">
            <div className="flex-1 min-w-0">
                <Label className="text-sm font-medium text-foreground">{label}</Label>
                <p className="text-xs text-foreground-muted mt-0.5">{description}</p>
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    );
}

function ToggleSwitch({
    checked,
    onChange,
    disabled,
}: {
    checked: boolean;
    onChange: (val: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                checked ? "bg-accent-blue" : "bg-input"
            )}
        >
            <span
                className={cn(
                    "pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow-sm ring-0 transition-transform",
                    checked ? "translate-x-4" : "translate-x-0.5"
                )}
            />
        </button>
    );
}

function SegmentedControl<T extends string>({
    value,
    options,
    onChange,
    disabled,
}: {
    value: T;
    options: { label: string; value: T; icon?: React.ReactNode }[];
    onChange: (val: T) => void;
    disabled?: boolean;
}) {
    return (
        <div className="flex items-center gap-0.5 bg-background-secondary rounded-lg p-0.5">
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(opt.value)}
                    className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
                        value === opt.value
                            ? "bg-background text-foreground shadow-sm"
                            : "text-foreground-muted hover:text-foreground"
                    )}
                >
                    {opt.icon}
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

function TextSettingRow({
    label,
    description,
    value,
    placeholder,
    onChange,
    disabled,
}: {
    label: string;
    description: string;
    value: string;
    placeholder?: string;
    onChange: (val: string) => void;
    disabled?: boolean;
}) {
    return (
        <div className="py-3.5 border-b border-border/50 last:border-b-0">
            <div className="mb-2">
                <Label className="text-sm font-medium text-foreground">{label}</Label>
                <p className="text-xs text-foreground-muted mt-0.5">{description}</p>
            </div>
            <Input
                value={value}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className="h-8 text-sm"
            />
        </div>
    );
}

function ArraySettingRow({
    label,
    description,
    value,
    placeholder,
    onChange,
    disabled,
}: {
    label: string;
    description: string;
    value: string;
    placeholder?: string;
    onChange: (val: string) => void;
    disabled?: boolean;
}) {
    return (
        <div className="py-3.5 border-b border-border/50 last:border-b-0">
            <div className="mb-2">
                <Label className="text-sm font-medium text-foreground">{label}</Label>
                <p className="text-xs text-foreground-muted mt-0.5">{description}</p>
            </div>
            <Input
                value={value}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className="h-8 text-sm font-mono"
            />
        </div>
    );
}

// ── Section header ───────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, description }: {
    icon: React.ElementType;
    title: string;
    description: string;
}) {
    return (
        <div className="mb-5 pb-4 border-b border-border/50">
            <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 text-accent-blue" />
                <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            </div>
            <p className="text-xs text-foreground-muted">{description}</p>
        </div>
    );
}

// ── Main Panel Component ─────────────────────────────────────────────────

interface ProjectSettingsPanelProps {
    projectId: string;
    className?: string;
}

export function ProjectSettingsPanel({ projectId, className }: ProjectSettingsPanelProps) {
    const t = useTranslations('ProjectSettings');

    const { data: project, isLoading } = useProject(projectId);
    const updateSettings = useUpdateProjectSettings();
    const updateProject = useUpdateProject();

    const [activeTab, setActiveTab] = useState<ProjectSettingsTab>('general');
    const [projectLogo, setProjectLogo] = useState<string | null>(null);
    const [logoInitialized, setLogoInitialized] = useState(false);

    // Sync logo state from project data
    if (project && !logoInitialized) {
        setProjectLogo(project.logo || null);
        setLogoInitialized(true);
    }

    type ResolvedSettings = Required<ProjectSettings>;

    // Merge project settings with defaults — always produces a full object
    const savedSettings: ResolvedSettings = useMemo(() => ({
        ...DEFAULT_PROJECT_SETTINGS,
        ...(project?.settings ?? {}),
    }) as ResolvedSettings, [project?.settings]);

    // Draft overrides (only keys the user touched)
    const [draftOverrides, setDraftOverrides] = useState<Partial<ProjectSettings>>({});

    // Current settings being displayed (saved + draft overrides)
    const settings: ResolvedSettings = useMemo(() => ({
        ...savedSettings,
        ...draftOverrides,
    }), [savedSettings, draftOverrides]);

    // Detect unsaved changes
    const hasChanges = useMemo(() => {
        return (Object.keys(draftOverrides) as (keyof ProjectSettings)[]).some((key) => {
            const draftVal = draftOverrides[key];
            const savedVal = savedSettings[key];
            // Deep compare for arrays
            if (Array.isArray(draftVal) && Array.isArray(savedVal)) {
                return JSON.stringify(draftVal) !== JSON.stringify(savedVal);
            }
            return draftVal !== savedVal;
        });
    }, [draftOverrides, savedSettings]);

    const isPending = updateSettings.isPending;

    // Update a draft setting
    const updateDraft = useCallback((key: keyof ProjectSettings, value: any) => {
        setDraftOverrides((prev) => ({ ...prev, [key]: value }));
    }, []);

    // Logo handlers
    const handleLogoUpload = useCallback((files: FileWithProgress[]) => {
        const file = files[0];
        if (file?.fileUrl) {
            setProjectLogo(file.fileUrl);
            // Save logo immediately
            updateProject.mutate(
                { id: projectId, data: { logo: file.fileUrl } },
                {
                    onSuccess: () => toast.success(t('saved')),
                    onError: () => toast.error(t('logoUploadFailed')),
                }
            );
        }
    }, [projectId, updateProject, t]);

    const handleRemoveLogo = useCallback(() => {
        setProjectLogo(null);
        updateProject.mutate(
            { id: projectId, data: { logo: null } },
            {
                onSuccess: () => toast.success(t('saved')),
                onError: () => toast.error(t('saveFailed')),
            }
        );
    }, [projectId, updateProject, t]);

    const logoFullUrl = projectLogo
        ? projectLogo.startsWith('http') ? projectLogo : `${ENV.S3_URL_BASE}${projectLogo}`
        : null;

    // Helper for array fields — stored as comma-separated in draft, parsed on save
    const updateArrayDraft = useCallback((key: keyof ProjectSettings, raw: string) => {
        const parsed = raw.split(',').map((s) => s.trim()).filter(Boolean);
        setDraftOverrides((prev) => ({ ...prev, [key]: parsed }));
    }, []);

    // Save all changes at once
    const handleSave = useCallback(async () => {
        if (!hasChanges) return;

        const changed: Partial<ProjectSettings> = {};
        (Object.keys(draftOverrides) as (keyof ProjectSettings)[]).forEach((key) => {
            const draftVal = draftOverrides[key];
            const savedVal = savedSettings[key];
            const isDiff = Array.isArray(draftVal) && Array.isArray(savedVal)
                ? JSON.stringify(draftVal) !== JSON.stringify(savedVal)
                : draftVal !== savedVal;
            if (isDiff) {
                (changed as any)[key] = draftVal;
            }
        });

        try {
            await updateSettings.mutateAsync({ id: projectId, settings: changed });
            setDraftOverrides({});
            toast.success(t('saved'));
        } catch {
            toast.error(t('saveFailed'));
        }
    }, [hasChanges, draftOverrides, savedSettings, updateSettings, projectId, t]);

    // ── Tab definitions ──────────────────────────────────────────────
    const tabs: SettingsTabDef<ProjectSettingsTab>[] = useMemo(() => [
        { key: 'general', label: t('general'), icon: Globe },
        { key: 'assistant', label: t('assistant'), icon: Bot },
        { key: 'security', label: t('security'), icon: Shield },
        { key: 'permissions', label: t('memberPermissions'), icon: Users },
        { key: 'notifications', label: t('notifications'), icon: Bell },
    ], [t]);

    // ── Loading / Error ─────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className={cn("flex items-center justify-center h-64", className)}>
                <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
            </div>
        );
    }

    if (!project) return null;

    // ── Render ───────────────────────────────────────────────────────
    return (
        <div className={cn("flex flex-col h-full bg-background transition-colors duration-300", className)}>
            {/* ── Top toolbar ────────────────────────────────────── */}
            <header className="h-12 bg-background border-b border-border flex items-center justify-between px-4 z-20 shrink-0 sticky top-0">
                <div className="flex items-center gap-2.5">
                    <Settings className="h-4 w-4 text-foreground-muted" />
                    <h1 className="text-base font-semibold text-foreground">{t('title')}</h1>
                </div>
                <div className="flex items-center gap-3">
                    {hasChanges && (
                        <span className="text-xs text-amber-500 font-medium flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            {t('unsavedChanges')}
                        </span>
                    )}
                    <Button
                        size="sm"
                        disabled={!hasChanges || isPending}
                        onClick={handleSave}
                        className="gap-1.5"
                    >
                        {isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Save className="h-3.5 w-3.5" />
                        )}
                        {isPending ? t('saving') : t('save')}
                    </Button>
                </div>
            </header>

            {/* ── Body: sidebar + content ─────────────────────────── */}
            <div className="flex flex-1 min-h-0">
                {/* ── Collapsible sidebar ─────────────────────────── */}
                <SettingsSidebar
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    heading={t('title')}
                />

                {/* ── Content area ─────────────────────────────────── */}
                <main className="flex-1 min-h-0 overflow-y-auto bg-background-secondary dark:bg-background">
                    <div className="max-w-2xl mx-auto py-6 px-6">
                        {/* ── General & Mode ──────────────────── */}
                        {activeTab === 'general' && (
                            <div>
                                <SectionHeader
                                    icon={Globe}
                                    title={t('general')}
                                    description={t('generalDescription')}
                                />

                                {/* Logo upload */}
                                <div className="py-3.5 border-b border-border/50">
                                    <div className="mb-2">
                                        <Label className="text-sm font-medium text-foreground">{t('logoTitle')}</Label>
                                        <p className="text-xs text-foreground-muted mt-0.5">{t('logoDescription')}</p>
                                    </div>
                                    <div className="flex items-center gap-5">
                                        <FileUpload
                                            s3Type="logo"
                                            uploadPath={`projects/${projectId}`}
                                            allowedTypes={['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']}
                                            maxSize={5242880}
                                            multiple={false}
                                            showDropzone={false}
                                            showFiles={false}
                                            showInfo={false}
                                            showPlaceholder={false}
                                            className="w-auto"
                                            contentClassName="justify-start"
                                            onUploadSuccess={handleLogoUpload}
                                            onUploadError={(error) => {
                                                console.error('Logo upload error:', error);
                                                toast.error(t('logoUploadFailed'));
                                            }}
                                        >
                                            <div className="relative group cursor-pointer">
                                                <div className="h-20 w-20 rounded-xl bg-background-tertiary border border-border flex items-center justify-center overflow-hidden transition-opacity group-hover:opacity-80">
                                                    {logoFullUrl ? (
                                                        <Image
                                                            src={logoFullUrl}
                                                            alt={project?.name || t('projectLogo')}
                                                            width={80}
                                                            height={80}
                                                            className="h-full w-full object-contain p-1"
                                                            unoptimized={!logoFullUrl.startsWith('https://ik.imagekit.io')}
                                                        />
                                                    ) : (
                                                        <FolderKanban className="h-8 w-8 text-foreground-muted" />
                                                    )}
                                                </div>
                                                <div className="absolute inset-0 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <ImageIcon className="h-5 w-5 text-white" />
                                                </div>
                                            </div>
                                        </FileUpload>
                                        <div className="flex flex-col gap-1">
                                            <p className="text-sm font-medium text-foreground">
                                                {project?.name || t('projectLogo')}
                                            </p>
                                            <p className="text-xs text-foreground-subtle">
                                                {projectLogo ? t('clickLogoToReplace') : t('clickToUploadLogo')}
                                            </p>
                                            {projectLogo && (
                                                <button
                                                    type="button"
                                                    className="text-xs text-foreground-muted hover:text-destructive transition-colors text-left mt-1 w-fit"
                                                    onClick={handleRemoveLogo}
                                                >
                                                    {t('removeLogo')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <TextSettingRow
                                    label={t('projectDescription')}
                                    description={t('projectDescriptionDesc')}
                                    value={settings.description ?? ''}
                                    placeholder={t('projectDescriptionPlaceholder')}
                                    onChange={(v) => updateDraft('description', v)}
                                    disabled={isPending}
                                />
                                <SettingRow label={t('lumawayMode')} description={t('lumawayModeDesc')}>
                                    <SegmentedControl
                                        value={settings.mode!}
                                        disabled={isPending}
                                        onChange={(v) => updateDraft('mode', v)}
                                        options={[
                                            { label: t('modeGuided'), value: 'guided' },
                                            { label: t('modeSelfServe'), value: 'self-serve' },
                                            { label: t('modeHybrid'), value: 'hybrid' },
                                        ]}
                                    />
                                </SettingRow>
                            </div>
                        )}

                        {/* ── Assistant & Chatbot ──────────────── */}
                        {activeTab === 'assistant' && (
                            <div>
                                <SectionHeader
                                    icon={Bot}
                                    title={t('assistant')}
                                    description={t('assistantDescription')}
                                />
                                <SettingRow label={t('assistantEnabled')} description={t('assistantEnabledDesc')}>
                                    <ToggleSwitch
                                        checked={settings.assistantEnabled!}
                                        disabled={isPending}
                                        onChange={(v) => updateDraft('assistantEnabled', v)}
                                    />
                                </SettingRow>
                                {settings.assistantEnabled && (
                                    <>
                                        <TextSettingRow
                                            label={t('assistantName')}
                                            description={t('assistantNameDesc')}
                                            value={settings.assistantName ?? ''}
                                            placeholder={t('assistantNamePlaceholder')}
                                            onChange={(v) => updateDraft('assistantName', v)}
                                            disabled={isPending}
                                        />
                                        <TextSettingRow
                                            label={t('assistantWelcomeMessage')}
                                            description={t('assistantWelcomeMessageDesc')}
                                            value={settings.assistantWelcomeMessage ?? ''}
                                            placeholder={t('assistantWelcomeMessagePlaceholder')}
                                            onChange={(v) => updateDraft('assistantWelcomeMessage', v)}
                                            disabled={isPending}
                                        />
                                    </>
                                )}
                                <SettingRow label={t('chatbotEnabled')} description={t('chatbotEnabledDesc')}>
                                    <ToggleSwitch
                                        checked={settings.chatbotEnabled!}
                                        disabled={isPending}
                                        onChange={(v) => updateDraft('chatbotEnabled', v)}
                                    />
                                </SettingRow>
                            </div>
                        )}

                        {/* ── Security ─────────────────────────── */}
                        {activeTab === 'security' && (
                            <div>
                                <SectionHeader
                                    icon={Shield}
                                    title={t('security')}
                                    description={t('securityDescription')}
                                />
                                <SettingRow label={t('requireApiKey')} description={t('requireApiKeyDesc')}>
                                    <ToggleSwitch
                                        checked={settings.requireApiKey!}
                                        disabled={isPending}
                                        onChange={(v) => updateDraft('requireApiKey', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('allowPublicAccess')} description={t('allowPublicAccessDesc')}>
                                    <ToggleSwitch
                                        checked={settings.allowPublicAccess!}
                                        disabled={isPending}
                                        onChange={(v) => updateDraft('allowPublicAccess', v)}
                                    />
                                </SettingRow>
                                <ArraySettingRow
                                    label={t('allowedDomains')}
                                    description={t('allowedDomainsDesc')}
                                    value={(settings.allowedDomains ?? []).join(', ')}
                                    placeholder={t('allowedDomainsPlaceholder')}
                                    onChange={(v) => updateArrayDraft('allowedDomains', v)}
                                    disabled={isPending}
                                />
                                <ArraySettingRow
                                    label={t('ipWhitelist')}
                                    description={t('ipWhitelistDesc')}
                                    value={(settings.ipWhitelist ?? []).join(', ')}
                                    placeholder={t('ipWhitelistPlaceholder')}
                                    onChange={(v) => updateArrayDraft('ipWhitelist', v)}
                                    disabled={isPending}
                                />
                            </div>
                        )}

                        {/* ── Member Permissions ───────────────── */}
                        {activeTab === 'permissions' && (
                            <div>
                                <SectionHeader
                                    icon={Users}
                                    title={t('memberPermissions')}
                                    description={t('memberPermissionsDescription')}
                                />
                                <div className="mb-3 mt-1">
                                    <span className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                                        Editors
                                    </span>
                                </div>
                                <SettingRow label={t('editorCanPublish')} description={t('editorCanPublishDesc')}>
                                    <ToggleSwitch
                                        checked={settings.editorCanPublish!}
                                        disabled={isPending}
                                        onChange={(v) => updateDraft('editorCanPublish', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('editorCanDelete')} description={t('editorCanDeleteDesc')}>
                                    <ToggleSwitch
                                        checked={settings.editorCanDelete!}
                                        disabled={isPending}
                                        onChange={(v) => updateDraft('editorCanDelete', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('editorCanInvite')} description={t('editorCanInviteDesc')}>
                                    <ToggleSwitch
                                        checked={settings.editorCanInvite!}
                                        disabled={isPending}
                                        onChange={(v) => updateDraft('editorCanInvite', v)}
                                    />
                                </SettingRow>

                                <div className="mb-3 mt-4">
                                    <span className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                                        Viewers
                                    </span>
                                </div>
                                <SettingRow label={t('viewerCanComment')} description={t('viewerCanCommentDesc')}>
                                    <ToggleSwitch
                                        checked={settings.viewerCanComment!}
                                        disabled={isPending}
                                        onChange={(v) => updateDraft('viewerCanComment', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('viewerCanExport')} description={t('viewerCanExportDesc')}>
                                    <ToggleSwitch
                                        checked={settings.viewerCanExport!}
                                        disabled={isPending}
                                        onChange={(v) => updateDraft('viewerCanExport', v)}
                                    />
                                </SettingRow>
                            </div>
                        )}

                        {/* ── Notifications ─────────────────────── */}
                        {activeTab === 'notifications' && (
                            <div>
                                <SectionHeader
                                    icon={Bell}
                                    title={t('notifications')}
                                    description={t('notificationsDescription')}
                                />
                                <div className="mb-3 mt-1">
                                    <span className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                                        {t('lifecycleEvents')}
                                    </span>
                                </div>
                                <SettingRow label={t('notifyOnPublish')} description={t('notifyOnPublishDesc')}>
                                    <ToggleSwitch
                                        checked={settings.notifyOnPublish!}
                                        disabled={isPending}
                                        onChange={(v) => updateDraft('notifyOnPublish', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('notifyOnNewMember')} description={t('notifyOnNewMemberDesc')}>
                                    <ToggleSwitch
                                        checked={settings.notifyOnNewMember!}
                                        disabled={isPending}
                                        onChange={(v) => updateDraft('notifyOnNewMember', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('notifyOnWalkthroughUpdate')} description={t('notifyOnWalkthroughUpdateDesc')}>
                                    <ToggleSwitch
                                        checked={settings.notifyOnWalkthroughUpdate!}
                                        disabled={isPending}
                                        onChange={(v) => updateDraft('notifyOnWalkthroughUpdate', v)}
                                    />
                                </SettingRow>

                                <div className="mb-3 mt-4">
                                    <span className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                                        {t('commentActivity')}
                                    </span>
                                </div>
                                <SettingRow label={t('notifyOnMention')} description={t('notifyOnMentionDesc')}>
                                    <ToggleSwitch
                                        checked={settings.notifyOnMention!}
                                        disabled={isPending}
                                        onChange={(v) => updateDraft('notifyOnMention', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('notifyOnReply')} description={t('notifyOnReplyDesc')}>
                                    <ToggleSwitch
                                        checked={settings.notifyOnReply!}
                                        disabled={isPending}
                                        onChange={(v) => updateDraft('notifyOnReply', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('notifyOnReaction')} description={t('notifyOnReactionDesc')}>
                                    <ToggleSwitch
                                        checked={settings.notifyOnReaction!}
                                        disabled={isPending}
                                        onChange={(v) => updateDraft('notifyOnReaction', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('notifyOnCorrection')} description={t('notifyOnCorrectionDesc')}>
                                    <ToggleSwitch
                                        checked={settings.notifyOnCorrection!}
                                        disabled={isPending}
                                        onChange={(v) => updateDraft('notifyOnCorrection', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('notifyOnResolved')} description={t('notifyOnResolvedDesc')}>
                                    <ToggleSwitch
                                        checked={settings.notifyOnResolved!}
                                        disabled={isPending}
                                        onChange={(v) => updateDraft('notifyOnResolved', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('notifyOnAnnouncement')} description={t('notifyOnAnnouncementDesc')}>
                                    <ToggleSwitch
                                        checked={settings.notifyOnAnnouncement!}
                                        disabled={isPending}
                                        onChange={(v) => updateDraft('notifyOnAnnouncement', v)}
                                    />
                                </SettingRow>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
