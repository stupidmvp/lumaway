'use client';

import { useCallback, useMemo, useState } from 'react';
import { useProject, useUpdateProject, useUpdateProjectSettings, usePermissions, DEFAULT_PROJECT_SETTINGS, type ProjectSettings } from '@luma/infra';
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
    Settings,
    ImageIcon,
    FolderKanban,
    X,
    Plus,
    GitPullRequest,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { SettingsSidebar, type SettingsTabDef } from '@/components/shared/SettingsSidebar';
import { FileUpload, type FileWithProgress } from '@/components/ui/file-upload';
import { useProjectMembers } from '@luma/infra';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Autocomplete } from '@/components/ui/autocomplete';
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
    onSave,
    disabled,
}: {
    label: string;
    description: string;
    value: string;
    placeholder?: string;
    onSave: (val: string) => void;
    disabled?: boolean;
}) {
    const [localValue, setLocalValue] = useState(value);

    // Sync local value when prop changes (e.g. from DB)
    // Only if not currently focused? For simplicity, we sync always, assuming single user.
    if (value !== localValue && document.activeElement?.tagName !== 'INPUT') {
        // This check is a bit naive in render, triggering state update.
        // Better to use useEffect, but we need to avoid overwriting while typing.
        // Let's use useEffect with a strict dependency.
    }

    // We use a key-based approach or naive state init.
    // Given the simple nature, useState initial value is sufficient for now.

    const handleBlur = () => {
        if (localValue !== value) {
            onSave(localValue);
        }
    };

    return (
        <div className="py-3.5 border-b border-border/50 last:border-b-0">
            <div className="mb-2">
                <Label className="text-sm font-medium text-foreground">{label}</Label>
                <p className="text-xs text-foreground-muted mt-0.5">{description}</p>
            </div>
            <Input
                value={localValue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalValue(e.target.value)}
                onBlur={handleBlur}
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
    value, // comma separated string or array? The helper signature assumed string in previous code.
    placeholder,
    onSave, // receives the new comma-separated string
    disabled,
}: {
    label: string;
    description: string;
    value: string;
    placeholder?: string;
    onSave: (val: string) => void;
    disabled?: boolean;
}) {
    const [localValue, setLocalValue] = useState(value);

    const handleBlur = () => {
        if (localValue !== value) {
            onSave(localValue);
        }
    };

    return (
        <div className="py-3.5 border-b border-border/50 last:border-b-0">
            <div className="mb-2">
                <Label className="text-sm font-medium text-foreground">{label}</Label>
                <p className="text-xs text-foreground-muted mt-0.5">{description}</p>
            </div>
            <Input
                value={localValue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalValue(e.target.value)}
                onBlur={handleBlur}
                placeholder={placeholder}
                disabled={disabled}
                className="h-8 text-sm font-mono"
            />
        </div>
    );
}

// ── Reviewer List ────────────────────────────────────────────────────────

function ReviewerList({
    projectId,
    reviewerIds,
    onChange,
    isPending,
    canUpdate,
}: {
    projectId: string;
    reviewerIds: string[];
    onChange: (ids: string[]) => void;
    isPending: boolean;
    canUpdate: boolean;
}) {
    const t = useTranslations('ProjectSettings');
    const { data: membersResult } = useProjectMembers(projectId, undefined, 100);
    const members = membersResult?.data || [];

    const reviewers = useMemo(() => {
        return members
            .filter((m) => reviewerIds.includes(m.userId))
            .map((m) => m.user);
    }, [members, reviewerIds]);

    const nonReviewers = useMemo(() => {
        return members.filter((m) => !reviewerIds.includes(m.userId));
    }, [members, reviewerIds]);

    const handleAdd = (userId: string) => {
        if (!reviewerIds.includes(userId)) {
            onChange([...reviewerIds, userId]);
        }
    };

    const handleRemove = (userId: string) => {
        onChange(reviewerIds.filter((id) => id !== userId));
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <Label className="text-sm font-medium text-foreground">{t('reviewers')}</Label>
                    <p className="text-xs text-foreground-muted mt-0.5">{t('reviewersDesc')}</p>
                </div>

                <div className="w-56">
                    <Autocomplete
                        service="project-members"
                        optionValue="userId"
                        placeholder={t('addReviewer')}
                        value="" // Always empty to act as a selector that adds to a list
                        filterDefaultValues={{ projectId }}
                        onValueChange={(userId, member) => {
                            if (userId && member) {
                                handleAdd(userId as string);
                            }
                        }}
                        disabled={isPending || !canUpdate}
                        triggerClassName="h-8 text-xs border-accent-blue/20 hover:border-accent-blue/40 text-accent-blue hover:bg-accent-blue/5"
                        renderOptionLabel={(member) => {
                            const user = member.user;
                            const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
                            const isAlreadyReviewer = reviewerIds.includes(member.userId);

                            return (
                                <div className={cn(
                                    "flex items-center gap-2 w-full",
                                    isAlreadyReviewer && "opacity-50 pointer-events-none"
                                )}>
                                    <UserAvatar
                                        firstName={user?.firstName}
                                        lastName={user?.lastName}
                                        avatar={user?.avatar}
                                        size="xs"
                                    />
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-medium truncate">
                                                {name || user?.email}
                                            </span>
                                            {isAlreadyReviewer && (
                                                <span className="text-[10px] bg-background-tertiary px-1 rounded uppercase tracking-wider font-bold opacity-70">
                                                    Reviewer
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-foreground-muted truncate">
                                            {user?.email}
                                        </span>
                                    </div>
                                </div>
                            );
                        }}
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                {reviewers.length === 0 ? (
                    <div className="text-[11px] text-foreground-subtle italic bg-background-secondary/50 rounded-lg p-3 border border-dashed border-border/50 text-center">
                        {t('noReviewers')}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-1.5">
                        {reviewers.map((user) => (
                            <div
                                key={user?.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-background-secondary border border-border/40 group"
                            >
                                <div className="flex items-center gap-3">
                                    <UserAvatar
                                        firstName={user?.firstName}
                                        lastName={user?.lastName}
                                        avatar={user?.avatar}
                                        size="md"
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-xs font-medium text-foreground">
                                            {user?.firstName} {user?.lastName}
                                        </span>
                                        <span className="text-[10px] text-foreground-muted">
                                            {user?.email}
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemove(user!.id)}
                                    disabled={isPending || !canUpdate}
                                    className="h-7 w-7 text-foreground-muted hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
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
    const settings: ResolvedSettings = useMemo(() => ({
        ...DEFAULT_PROJECT_SETTINGS,
        ...(project?.settings ?? {}),
    }) as ResolvedSettings, [project?.settings]);

    const isPending = updateSettings.isPending;
    const permissions = usePermissions();
    const canUpdate = permissions.can('update', 'projects', { projectId });

    // Direct update with auto-save
    const handleSettingChange = useCallback(async (key: keyof ProjectSettings, value: any) => {
        try {
            const updates: Partial<ProjectSettings> = { [key]: value };

            // If approval is required, editor cannot publish directly
            if (key === 'approvalRequired' && value === true) {
                updates.editorCanPublish = false;
            }

            // If editor can publish is enabled, approvals cannot be required
            if (key === 'editorCanPublish' && value === true) {
                updates.approvalRequired = false;
            }

            await updateSettings.mutateAsync({ id: projectId, settings: updates });
            toast.success(t('saved'));
        } catch {
            toast.error(t('saveFailed'));
        }
    }, [updateSettings, projectId, t]);

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

    // Helper for array fields — parsed on save
    const handleArrayChange = useCallback((key: keyof ProjectSettings, raw: string) => {
        const parsed = raw.split(',').map((s) => s.trim()).filter(Boolean);
        handleSettingChange(key, parsed);
    }, [handleSettingChange]);

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
                    {isPending && (
                        <span className="text-xs text-foreground-muted flex items-center gap-1.5">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {t('saving')}
                        </span>
                    )}
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
                                    key={settings.description} // Re-mount if external value totally changes? Or let internal logic handle it.
                                    // Actually, passing key forces remount and sync from prop, which is brutal but safe for reliability if we don't assume concurrent edits.
                                    // But it kills focus if it happens during typing.
                                    // Let's NOT use key here, and rely on just initializing state.
                                    label={t('projectDescription')}
                                    description={t('projectDescriptionDesc')}
                                    value={settings.description ?? ''}
                                    placeholder={t('projectDescriptionPlaceholder')}
                                    onSave={(v) => handleSettingChange('description', v)}
                                    disabled={isPending}
                                />
                                <SettingRow label={t('lumawayMode')} description={t('lumawayModeDesc')}>
                                    <SegmentedControl
                                        value={settings.mode!}
                                        disabled={isPending}
                                        onChange={(v) => handleSettingChange('mode', v)}
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
                                        onChange={(v) => handleSettingChange('assistantEnabled', v)}
                                    />
                                </SettingRow>
                                {settings.assistantEnabled && (
                                    <>
                                        <TextSettingRow
                                            label={t('assistantName')}
                                            description={t('assistantNameDesc')}
                                            value={settings.assistantName ?? ''}
                                            placeholder={t('assistantNamePlaceholder')}
                                            onSave={(v) => handleSettingChange('assistantName', v)}
                                            disabled={isPending}
                                        />
                                        <TextSettingRow
                                            label={t('assistantWelcomeMessage')}
                                            description={t('assistantWelcomeMessageDesc')}
                                            value={settings.assistantWelcomeMessage ?? ''}
                                            placeholder={t('assistantWelcomeMessagePlaceholder')}
                                            onSave={(v) => handleSettingChange('assistantWelcomeMessage', v)}
                                            disabled={isPending}
                                        />
                                    </>
                                )}
                                <SettingRow label={t('chatbotEnabled')} description={t('chatbotEnabledDesc')}>
                                    <ToggleSwitch
                                        checked={settings.chatbotEnabled!}
                                        disabled={isPending}
                                        onChange={(v) => handleSettingChange('chatbotEnabled', v)}
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
                                        onChange={(v) => handleSettingChange('requireApiKey', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('allowPublicAccess')} description={t('allowPublicAccessDesc')}>
                                    <ToggleSwitch
                                        checked={settings.allowPublicAccess!}
                                        disabled={isPending}
                                        onChange={(v) => handleSettingChange('allowPublicAccess', v)}
                                    />
                                </SettingRow>
                                <ArraySettingRow
                                    label={t('allowedDomains')}
                                    description={t('allowedDomainsDesc')}
                                    value={(settings.allowedDomains ?? []).join(', ')}
                                    placeholder={t('allowedDomainsPlaceholder')}
                                    onSave={(v) => handleArrayChange('allowedDomains', v)}
                                    disabled={isPending}
                                />
                                <ArraySettingRow
                                    label={t('ipWhitelist')}
                                    description={t('ipWhitelistDesc')}
                                    value={(settings.ipWhitelist ?? []).join(', ')}
                                    placeholder={t('ipWhitelistPlaceholder')}
                                    onSave={(v) => handleArrayChange('ipWhitelist', v)}
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
                                        disabled={isPending || !canUpdate}
                                        onChange={(v) => handleSettingChange('editorCanPublish', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('editorCanDelete')} description={t('editorCanDeleteDesc')}>
                                    <ToggleSwitch
                                        checked={settings.editorCanDelete!}
                                        disabled={isPending || !canUpdate}
                                        onChange={(v) => handleSettingChange('editorCanDelete', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('editorCanInvite')} description={t('editorCanInviteDesc')}>
                                    <ToggleSwitch
                                        checked={settings.editorCanInvite!}
                                        disabled={isPending || !canUpdate}
                                        onChange={(v) => handleSettingChange('editorCanInvite', v)}
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
                                        disabled={isPending || !canUpdate}
                                        onChange={(v) => handleSettingChange('viewerCanComment', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('viewerCanExport')} description={t('viewerCanExportDesc')}>
                                    <ToggleSwitch
                                        checked={settings.viewerCanExport!}
                                        disabled={isPending || !canUpdate}
                                        onChange={(v) => handleSettingChange('viewerCanExport', v)}
                                    />
                                </SettingRow>

                                <>
                                    <div className="flex items-center gap-2 mb-3 mt-4 pt-4 border-t border-border/50">
                                        <GitPullRequest className="h-3.5 w-3.5 text-accent-blue" />
                                        <span className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                                            {t('approvalWorkflow')}
                                        </span>
                                    </div>
                                    <SettingRow label={t('approvalRequired')} description={t('approvalRequiredDesc')}>
                                        <ToggleSwitch
                                            checked={settings.approvalRequired!}
                                            disabled={isPending || !canUpdate}
                                            onChange={(v) => handleSettingChange('approvalRequired', v)}
                                        />
                                    </SettingRow>
                                </>
                                {settings.approvalRequired && (
                                    <div className="py-3.5 border-b border-border/50 last:border-b-0">
                                        <div className="flex items-center justify-between gap-6">
                                            <div className="flex-1 min-w-0">
                                                <Label className="text-sm font-medium text-foreground">{t('minApprovals')}</Label>
                                                <p className="text-xs text-foreground-muted mt-0.5">{t('minApprovalsDesc')}</p>
                                            </div>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={10}
                                                value={settings.minApprovals ?? 1}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSettingChange('minApprovals', parseInt(e.target.value) || 1)}
                                                disabled={isPending || !canUpdate}
                                                className="w-16 h-8 text-sm text-center"
                                            />
                                        </div>
                                    </div>
                                )}

                                {settings.approvalRequired && (
                                    <div className="mt-4">
                                        <ReviewerList
                                            projectId={projectId}
                                            reviewerIds={settings.reviewerUserIds || []}
                                            onChange={(ids) => handleSettingChange('reviewerUserIds', ids)}
                                            isPending={isPending}
                                            canUpdate={canUpdate}
                                        />
                                    </div>
                                )}
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
                                        onChange={(v) => handleSettingChange('notifyOnPublish', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('notifyOnNewMember')} description={t('notifyOnNewMemberDesc')}>
                                    <ToggleSwitch
                                        checked={settings.notifyOnNewMember!}
                                        disabled={isPending}
                                        onChange={(v) => handleSettingChange('notifyOnNewMember', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('notifyOnWalkthroughUpdate')} description={t('notifyOnWalkthroughUpdateDesc')}>
                                    <ToggleSwitch
                                        checked={settings.notifyOnWalkthroughUpdate!}
                                        disabled={isPending}
                                        onChange={(v) => handleSettingChange('notifyOnWalkthroughUpdate', v)}
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
                                        onChange={(v) => handleSettingChange('notifyOnMention', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('notifyOnReply')} description={t('notifyOnReplyDesc')}>
                                    <ToggleSwitch
                                        checked={settings.notifyOnReply!}
                                        disabled={isPending}
                                        onChange={(v) => handleSettingChange('notifyOnReply', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('notifyOnReaction')} description={t('notifyOnReactionDesc')}>
                                    <ToggleSwitch
                                        checked={settings.notifyOnReaction!}
                                        disabled={isPending}
                                        onChange={(v) => handleSettingChange('notifyOnReaction', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('notifyOnCorrection')} description={t('notifyOnCorrectionDesc')}>
                                    <ToggleSwitch
                                        checked={settings.notifyOnCorrection!}
                                        disabled={isPending}
                                        onChange={(v) => handleSettingChange('notifyOnCorrection', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('notifyOnResolved')} description={t('notifyOnResolvedDesc')}>
                                    <ToggleSwitch
                                        checked={settings.notifyOnResolved!}
                                        disabled={isPending}
                                        onChange={(v) => handleSettingChange('notifyOnResolved', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('notifyOnAnnouncement')} description={t('notifyOnAnnouncementDesc')}>
                                    <ToggleSwitch
                                        checked={settings.notifyOnAnnouncement!}
                                        disabled={isPending}
                                        onChange={(v) => handleSettingChange('notifyOnAnnouncement', v)}
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
