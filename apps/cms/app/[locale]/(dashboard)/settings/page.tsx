'use client';

import { useCurrentUser, useUpdatePreferences, UserPreferences, DEFAULT_PREFERENCES } from '@luma/infra';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
    Loader2, Settings, Palette, Globe, Bell, Code2,
    Monitor, Sun, Moon, Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useCallback, useMemo, useState } from 'react';
import { SettingsSidebar, type SettingsTabDef } from '@/components/shared/SettingsSidebar';

// ── Tab type ─────────────────────────────────────────────────────────────

type SettingsTab = 'appearance' | 'general' | 'notifications' | 'emailByActivity' | 'editor';

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

function SelectControl<T extends string>({
    value,
    options,
    onChange,
    disabled,
}: {
    value: T;
    options: { label: string; value: T }[];
    onChange: (val: T) => void;
    disabled?: boolean;
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value as T)}
            disabled={disabled}
            className="h-8 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer appearance-none pr-7"
            style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 0.25rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '1.25em 1.25em',
            }}
        >
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    );
}

// ── Section header (used inside each tab panel) ──────────────────────────

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

// ── Settings Page ────────────────────────────────────────────────────────

export default function SettingsPage() {
    const { data: user, isLoading } = useCurrentUser();
    const updatePreferences = useUpdatePreferences();
    const t = useTranslations('Settings');
    const { setTheme } = useTheme();
    const router = useRouter();
    const pathname = usePathname();

    const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

    type ResolvedPrefs = Required<UserPreferences>;

    // Merge user prefs with defaults — always produces a full object
    const prefs: ResolvedPrefs = useMemo(() => ({
        ...DEFAULT_PREFERENCES,
        ...(user?.preferences ?? {}),
    }) as ResolvedPrefs, [user?.preferences]);

    const isPending = updatePreferences.isPending;

    // Direct update with auto-save and side effects
    const handleSettingChange = useCallback(async (key: keyof UserPreferences, value: any) => {
        // Optimistic update or just wait for revalidation?
        // Since we are using react-query invalidate, the UI might flicker if we don't optimistically update,
        // but for settings it's usually fine. To be safer and snappier, the mutation layout usually handles it.
        // For now, we just fire the mutation.

        try {
            const changed = { [key]: value };
            await updatePreferences.mutateAsync(changed);

            // Side effects for theme & language (Immediate application)
            if (key === 'theme') {
                setTheme(value);
            }
            if (key === 'language') {
                const segments = pathname.split('/');
                // Assuming locale is at index 1 (e.g. /en/...)
                if (segments[1] && ['en', 'es'].includes(segments[1])) {
                    segments[1] = value;
                }
                const newPath = segments.join('/');
                router.push(newPath);
            }

            toast.success(t('saved'));
        } catch {
            toast.error(t('saveFailed'));
        }
    }, [updatePreferences, setTheme, router, pathname, t]);

    // ── Tab definitions ──────────────────────────────────────────────
    const tabs: SettingsTabDef<SettingsTab>[] = useMemo(() => [
        { key: 'appearance', label: t('appearance'), icon: Palette },
        { key: 'general', label: t('general'), icon: Globe },
        { key: 'notifications', label: t('notifications'), icon: Bell },
        { key: 'emailByActivity', label: t('emailByActivity'), icon: Mail },
        { key: 'editor', label: t('editor'), icon: Code2 },
    ], [t]);

    // ── Loading / Error ─────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-foreground-muted">{t('saveFailed')}</p>
            </div>
        );
    }

    // ── Render ───────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full bg-background transition-colors duration-300">
            {/* ── Top toolbar ────────────────────────────────────── */}
            <header className="h-12 bg-background border-b border-border flex items-center justify-between px-4 z-20 shrink-0 sticky top-0">
                <div className="flex items-center gap-2.5">
                    <Settings className="h-4 w-4 text-foreground-muted" />
                    <h1 className="text-base font-semibold text-foreground">{t('title')}</h1>
                </div>
                <div className="flex items-center gap-3">
                    {/* Auto-save indicator could go here if needed, but toast is enough for now */}
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
                {/* ── Internal sidebar (collapsible) ────────────── */}
                <SettingsSidebar
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    heading={t('title')}
                />

                {/* ── Content area ─────────────────────────────────── */}
                <main className="flex-1 min-h-0 overflow-y-auto bg-background-secondary dark:bg-background">
                    <div className="max-w-2xl mx-auto py-6 px-6">
                        {/* ── Appearance ────────────────────────── */}
                        {activeTab === 'appearance' && (
                            <div>
                                <SectionHeader
                                    icon={Palette}
                                    title={t('appearance')}
                                    description={t('appearanceDescription')}
                                />
                                <SettingRow label={t('theme')} description={t('themeDescription')}>
                                    <SegmentedControl
                                        value={prefs.theme}
                                        disabled={isPending}
                                        onChange={(v) => handleSettingChange('theme', v)}
                                        options={[
                                            { label: t('themeLight'), value: 'light', icon: <Sun className="h-3 w-3" /> },
                                            { label: t('themeDark'), value: 'dark', icon: <Moon className="h-3 w-3" /> },
                                        ]}
                                    />
                                </SettingRow>
                                <SettingRow label={t('language')} description={t('languageDescription')}>
                                    <SegmentedControl
                                        value={prefs.language}
                                        disabled={isPending}
                                        onChange={(v) => handleSettingChange('language', v)}
                                        options={[
                                            { label: t('languageEn'), value: 'en' },
                                            { label: t('languageEs'), value: 'es' },
                                        ]}
                                    />
                                </SettingRow>
                            </div>
                        )}

                        {/* ── General ───────────────────────────── */}
                        {activeTab === 'general' && (
                            <div>
                                <SectionHeader
                                    icon={Globe}
                                    title={t('general')}
                                    description={t('generalDescription')}
                                />
                                <SettingRow label={t('defaultHomePage')} description={t('defaultHomePageDescription')}>
                                    <SegmentedControl
                                        value={prefs.defaultHomePage}
                                        disabled={isPending}
                                        onChange={(v) => handleSettingChange('defaultHomePage', v)}
                                        options={[
                                            { label: t('homeProjects'), value: 'projects' },
                                            { label: t('homeWalkthroughs'), value: 'walkthroughs' },
                                        ]}
                                    />
                                </SettingRow>
                                <SettingRow label={t('displayNames')} description={t('displayNamesDescription')}>
                                    <SelectControl
                                        value={prefs.displayNames}
                                        disabled={isPending}
                                        onChange={(v) => handleSettingChange('displayNames', v)}
                                        options={[
                                            { label: t('displayFullName'), value: 'fullName' },
                                            { label: t('displayFirstName'), value: 'firstName' },
                                            { label: t('displayEmail'), value: 'email' },
                                        ]}
                                    />
                                </SettingRow>
                                <SettingRow label={t('firstDayOfWeek')} description={t('firstDayOfWeekDescription')}>
                                    <SegmentedControl
                                        value={prefs.firstDayOfWeek}
                                        disabled={isPending}
                                        onChange={(v) => handleSettingChange('firstDayOfWeek', v)}
                                        options={[
                                            { label: t('monday'), value: 'monday' },
                                            { label: t('sunday'), value: 'sunday' },
                                        ]}
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
                                <SettingRow label={t('emailNotifications')} description={t('emailNotificationsDescription')}>
                                    <ToggleSwitch
                                        checked={prefs.emailNotifications}
                                        disabled={isPending}
                                        onChange={(v) => handleSettingChange('emailNotifications', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('notifyOnInvitation')} description={t('notifyOnInvitationDescription')}>
                                    <ToggleSwitch
                                        checked={prefs.notifyOnInvitation}
                                        disabled={isPending || !prefs.emailNotifications}
                                        onChange={(v) => handleSettingChange('notifyOnInvitation', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('notifyOnMemberJoin')} description={t('notifyOnMemberJoinDescription')}>
                                    <ToggleSwitch
                                        checked={prefs.notifyOnMemberJoin}
                                        disabled={isPending || !prefs.emailNotifications}
                                        onChange={(v) => handleSettingChange('notifyOnMemberJoin', v)}
                                    />
                                </SettingRow>
                            </div>
                        )}

                        {/* ── Email by Activity ─────────────────── */}
                        {activeTab === 'emailByActivity' && (
                            <div>
                                <SectionHeader
                                    icon={Mail}
                                    title={t('emailByActivity')}
                                    description={t('emailByActivityDescription')}
                                />
                                <SettingRow label={t('emailOnMention')} description={t('emailOnMentionDescription')}>
                                    <ToggleSwitch
                                        checked={prefs.emailOnMention}
                                        disabled={isPending || !prefs.emailNotifications}
                                        onChange={(v) => handleSettingChange('emailOnMention', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('emailOnReply')} description={t('emailOnReplyDescription')}>
                                    <ToggleSwitch
                                        checked={prefs.emailOnReply}
                                        disabled={isPending || !prefs.emailNotifications}
                                        onChange={(v) => handleSettingChange('emailOnReply', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('emailOnReaction')} description={t('emailOnReactionDescription')}>
                                    <ToggleSwitch
                                        checked={prefs.emailOnReaction}
                                        disabled={isPending || !prefs.emailNotifications}
                                        onChange={(v) => handleSettingChange('emailOnReaction', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('emailOnCorrection')} description={t('emailOnCorrectionDescription')}>
                                    <ToggleSwitch
                                        checked={prefs.emailOnCorrection}
                                        disabled={isPending || !prefs.emailNotifications}
                                        onChange={(v) => handleSettingChange('emailOnCorrection', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('emailOnResolved')} description={t('emailOnResolvedDescription')}>
                                    <ToggleSwitch
                                        checked={prefs.emailOnResolved}
                                        disabled={isPending || !prefs.emailNotifications}
                                        onChange={(v) => handleSettingChange('emailOnResolved', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('emailOnAnnouncement')} description={t('emailOnAnnouncementDescription')}>
                                    <ToggleSwitch
                                        checked={prefs.emailOnAnnouncement}
                                        disabled={isPending || !prefs.emailNotifications}
                                        onChange={(v) => handleSettingChange('emailOnAnnouncement', v)}
                                    />
                                </SettingRow>
                            </div>
                        )}

                        {/* ── Editor ────────────────────────────── */}
                        {activeTab === 'editor' && (
                            <div>
                                <SectionHeader
                                    icon={Code2}
                                    title={t('editor')}
                                    description={t('editorDescription')}
                                />
                                <SettingRow label={t('editorSidebarOpen')} description={t('editorSidebarOpenDescription')}>
                                    <ToggleSwitch
                                        checked={prefs.editorSidebarOpen}
                                        disabled={isPending}
                                        onChange={(v) => handleSettingChange('editorSidebarOpen', v)}
                                    />
                                </SettingRow>
                                <SettingRow label={t('defaultStepPlacement')} description={t('defaultStepPlacementDescription')}>
                                    <SelectControl
                                        value={prefs.defaultStepPlacement}
                                        disabled={isPending}
                                        onChange={(v) => handleSettingChange('defaultStepPlacement', v)}
                                        options={[
                                            { label: t('placementAuto'), value: 'auto' },
                                            { label: t('placementTop'), value: 'top' },
                                            { label: t('placementBottom'), value: 'bottom' },
                                            { label: t('placementLeft'), value: 'left' },
                                            { label: t('placementRight'), value: 'right' },
                                        ]}
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
