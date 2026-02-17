'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
    AuthService,
    useCurrentUser,
    useCompleteOnboarding,
} from '@luma/infra';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Loader2,
    GitPullRequest,
    Users,
    Keyboard,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';

// ─── Types ───────────────────────────────────────────────────────
type OnboardingStep = 'welcome' | 'theme' | 'workspace' | 'completed';

const ALL_STEPS: OnboardingStep[] = ['welcome', 'theme', 'workspace', 'completed'];

// ─── Helpers ─────────────────────────────────────────────────────
function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

// ─── Step Dot Indicator ──────────────────────────────────────────
function StepDots({ current, total }: { current: number; total: number }) {
    return (
        <div className="flex items-center justify-center gap-2.5">
            {Array.from({ length: total }).map((_, idx) => (
                <div
                    key={idx}
                    className={cn(
                        'w-2 h-2 rounded-full transition-all duration-300',
                        idx === current
                            ? 'bg-foreground-muted scale-125'
                            : idx < current
                                ? 'bg-foreground-subtle/60'
                                : 'bg-foreground-subtle/30'
                    )}
                />
            ))}
        </div>
    );
}

// ─── Primary Button ──────────────────────────────────────────────
function OnboardingButton({
    onClick,
    disabled,
    loading,
    children,
    className,
}: {
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled || loading}
            className={cn(
                'w-full max-w-[380px] h-[52px] rounded-xl font-medium text-[15px]',
                'bg-accent-blue text-white',
                'hover:opacity-90 active:scale-[0.98]',
                'transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                className
            )}
        >
            {loading ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            ) : (
                children
            )}
        </button>
    );
}

// ─── Theme Preview Card ──────────────────────────────────────────
const SIDEBAR_WIDTHS = [72, 85, 68, 90, 60];
const CONTENT_WIDTHS = [82, 90, 75];

function ThemeCard({
    mode,
    selected,
    onClick,
    label,
}: {
    mode: 'light' | 'dark';
    selected: boolean;
    onClick: () => void;
    label: string;
}) {
    const isLight = mode === 'light';

    return (
        <button
            onClick={onClick}
            className={cn(
                'flex-1 flex flex-col items-center gap-4 p-5 rounded-xl transition-all duration-200',
                'border',
                selected
                    ? 'bg-background-secondary border-accent-blue/50'
                    : 'bg-transparent border-transparent hover:bg-background-secondary/50'
            )}
        >
            {/* Preview mockup */}
            <div
                className={cn(
                    'w-full aspect-[4/3] rounded-lg border overflow-hidden shadow-lg',
                    isLight
                        ? 'bg-[#f8f8f8] border-gray-200'
                        : 'bg-[#1a1a1a] border-gray-700'
                )}
            >
                {/* Top bar */}
                <div className={cn(
                    'flex items-center gap-1.5 px-3 py-2 border-b',
                    isLight ? 'border-gray-200' : 'border-gray-700'
                )}>
                    <div className={cn('w-6 h-6 rounded-md', isLight ? 'bg-accent-blue/20' : 'bg-accent-blue/30')} />
                    <div className={cn('h-2 w-20 rounded', isLight ? 'bg-gray-300' : 'bg-gray-600')} />
                </div>
                {/* Content area */}
                <div className="flex h-full">
                    {/* Sidebar */}
                    <div className={cn(
                        'w-1/4 p-2 space-y-1.5 border-r',
                        isLight ? 'border-gray-200' : 'border-gray-700'
                    )}>
                        {SIDEBAR_WIDTHS.map((w, i) => (
                            <div
                                key={i}
                                className={cn(
                                    'h-1.5 rounded',
                                    isLight ? 'bg-gray-200' : 'bg-gray-600',
                                    i === 2 && (isLight ? 'bg-gray-300' : 'bg-gray-500')
                                )}
                                style={{ width: `${w}%` }}
                            />
                        ))}
                    </div>
                    {/* Main */}
                    <div className="flex-1 p-2 space-y-2">
                        <div className={cn('h-2 w-2/3 rounded', isLight ? 'bg-gray-300' : 'bg-gray-600')} />
                        <div className="space-y-1">
                            {CONTENT_WIDTHS.map((w, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        'h-1.5 rounded',
                                        isLight ? 'bg-gray-200' : 'bg-gray-700'
                                    )}
                                    style={{ width: `${w}%` }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Label */}
            <span className={cn(
                'text-sm font-medium',
                selected ? 'text-foreground' : 'text-foreground-muted'
            )}>
                {label}
            </span>
        </button>
    );
}

// ─── Main Component ──────────────────────────────────────────────
export default function OnboardingPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const t = useTranslations('Onboarding');
    const { theme, setTheme } = useTheme();
    const isRestart = searchParams.get('restart') === 'true';

    // Auth check
    const [tokenChecked, setTokenChecked] = useState(false);
    useEffect(() => {
        const token = AuthService.getToken();
        if (!token) {
            router.replace('/login');
        } else {
            setTokenChecked(true);
        }
    }, [router]);

    const { data: user, isLoading: userLoading } = useCurrentUser();
    const completeOnboardingMutation = useCompleteOnboarding();

    // Redirect if user already completed onboarding (unless restarting)
    useEffect(() => {
        if (user?.preferences?.onboardingCompleted && !isRestart) {
            router.replace('/projects');
        }
    }, [user, router, isRestart]);

    // ─── State ───────────────────────────────────────────────────
    const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
    const [mounted, setMounted] = useState(false);

    // Theme step
    const [selectedTheme, setSelectedTheme] = useState<'light' | 'dark'>('dark');

    // Workspace step
    const [workspaceName, setWorkspaceName] = useState('');
    const [workspaceSlug, setWorkspaceSlug] = useState('');
    const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

    // Hydration guard for theme
    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted && theme) {
            setSelectedTheme(theme === 'light' ? 'light' : 'dark');
        }
    }, [mounted, theme]);

    // Auto-generate slug from workspace name
    useEffect(() => {
        if (!slugManuallyEdited && workspaceName) {
            setWorkspaceSlug(slugify(workspaceName));
        }
    }, [workspaceName, slugManuallyEdited]);

    // ─── Step index ──────────────────────────────────────────────
    const currentStepIndex = ALL_STEPS.indexOf(currentStep);

    // ─── Validation ──────────────────────────────────────────────
    const canCreateWorkspace = useMemo(() => {
        return (
            workspaceName.trim().length > 0 &&
            workspaceSlug.trim().length > 0 &&
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug)
        );
    }, [workspaceName, workspaceSlug]);

    // ─── Actions ─────────────────────────────────────────────────
    const handleGetStarted = useCallback(() => {
        setCurrentStep('theme');
    }, []);

    const handleThemeContinue = useCallback(() => {
        setTheme(selectedTheme);
        setCurrentStep('workspace');
    }, [selectedTheme, setTheme]);

    const handleCreateWorkspace = useCallback(async () => {
        try {
            const res = await completeOnboardingMutation.mutateAsync({
                organizationName: workspaceName.trim(),
                organizationSlug: workspaceSlug.trim(),
            });
            if (res.organization?.id) {
                localStorage.setItem('lumaway_active_org', res.organization.id);
            }
            setCurrentStep('completed');
        } catch (err: any) {
            const message = err?.response?.data?.error || err?.message || t('error');
            toast.error(message);
        }
    }, [workspaceName, workspaceSlug, completeOnboardingMutation, t]);

    const handleOpenApp = useCallback(() => {
        router.push('/projects');
    }, [router]);

    // ─── Loading ─────────────────────────────────────────────────
    const isSubmitting = completeOnboardingMutation.isPending;

    if (!tokenChecked || userLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
            </div>
        );
    }

    // ─── Render ──────────────────────────────────────────────────
    return (
        <div className="min-h-screen flex flex-col bg-background">
            {/* Main content — centered */}
            <div className="flex-1 flex flex-col items-center justify-center px-6">

                {/* ──── STEP: Welcome ──── */}
                {currentStep === 'welcome' && (
                    <div className="flex flex-col items-center text-center max-w-lg animate-in fade-in duration-500">
                        {/* Logo */}
                        <div className="mb-10">
                            <Image
                                src="/luma.png"
                                alt="LumaWay"
                                width={80}
                                height={80}
                                className="object-contain rounded-2xl"
                                priority
                            />
                        </div>

                        {/* Title */}
                        <h1 className="text-[40px] font-semibold tracking-tight text-foreground leading-tight mb-5">
                            {t('welcomeTitle')}
                        </h1>

                        {/* Subtitle */}
                        <p className="text-base text-foreground-muted leading-relaxed max-w-sm mb-12">
                            {t('welcomeSubtitle')}
                        </p>

                        {/* CTA */}
                        <OnboardingButton onClick={handleGetStarted}>
                            {t('getStarted')}
                        </OnboardingButton>
                    </div>
                )}

                {/* ──── STEP: Theme ──── */}
                {currentStep === 'theme' && (
                    <div className="flex flex-col items-center text-center max-w-2xl w-full animate-in fade-in duration-500">
                        {/* Title */}
                        <h1 className="text-[28px] font-semibold tracking-tight text-foreground mb-3">
                            {t('themeTitle')}
                        </h1>

                        {/* Subtitle */}
                        <p className="text-sm text-foreground-muted leading-relaxed mb-10">
                            {t('themeSubtitle')}
                        </p>

                        {/* Theme cards */}
                        <div className="w-full max-w-xl border border-border rounded-xl p-1.5 flex mb-10">
                            <ThemeCard
                                mode="light"
                                selected={selectedTheme === 'light'}
                                onClick={() => setSelectedTheme('light')}
                                label={t('themeLight')}
                            />
                            <ThemeCard
                                mode="dark"
                                selected={selectedTheme === 'dark'}
                                onClick={() => setSelectedTheme('dark')}
                                label={t('themeDark')}
                            />
                        </div>

                        {/* Continue */}
                        <OnboardingButton onClick={handleThemeContinue}>
                            {t('continue')}
                        </OnboardingButton>
                    </div>
                )}

                {/* ──── STEP: Workspace ──── */}
                {currentStep === 'workspace' && (
                    <div className="flex flex-col items-center text-center max-w-lg w-full animate-in fade-in duration-500">
                        {/* Title */}
                        <h1 className="text-[28px] font-semibold tracking-tight text-foreground mb-3">
                            {t('workspaceTitle')}
                        </h1>

                        {/* Subtitle */}
                        <p className="text-sm text-foreground-muted leading-relaxed max-w-md mb-10">
                            {t('workspaceSubtitle')}
                        </p>

                        {/* Form */}
                        <div className="w-full max-w-md border border-border rounded-xl p-6 space-y-5 text-left mb-8">
                            <div className="space-y-2">
                                <Label htmlFor="workspaceName" className="text-sm font-medium text-foreground">
                                    {t('workspaceName')}
                                </Label>
                                <Input
                                    id="workspaceName"
                                    value={workspaceName}
                                    onChange={(e) => setWorkspaceName(e.target.value)}
                                    placeholder=""
                                    className="h-11 bg-background border-border"
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="workspaceSlug" className="text-sm font-medium text-foreground">
                                    {t('workspaceUrl')}
                                </Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-subtle select-none">
                                        lumaway.app/
                                    </span>
                                    <Input
                                        id="workspaceSlug"
                                        value={workspaceSlug}
                                        onChange={(e) => {
                                            setWorkspaceSlug(e.target.value);
                                            setSlugManuallyEdited(true);
                                        }}
                                        className="h-11 bg-background border-border pl-[106px] font-mono text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Create */}
                        <OnboardingButton
                            onClick={handleCreateWorkspace}
                            disabled={!canCreateWorkspace}
                            loading={isSubmitting}
                        >
                            {t('createWorkspace')}
                        </OnboardingButton>
                    </div>
                )}

                {/* ──── STEP: Completed ──── */}
                {currentStep === 'completed' && (
                    <div className="flex flex-col items-center text-center max-w-2xl w-full animate-in fade-in duration-500">
                        {/* Title */}
                        <h1 className="text-[28px] font-semibold tracking-tight text-foreground mb-3">
                            {t('completedTitle')}
                        </h1>

                        {/* Subtitle */}
                        <p className="text-sm text-foreground-muted leading-relaxed max-w-lg mb-10">
                            {t('completedSubtitle')}
                        </p>

                        {/* Feature cards */}
                        <div className="w-full max-w-2xl border border-border rounded-xl p-1.5 flex mb-10">
                            <div className="flex-1 p-5 text-left">
                                <GitPullRequest className="h-5 w-5 text-foreground-muted mb-3" />
                                <p className="text-sm font-medium text-foreground mb-1">
                                    {t('featureWalkthroughsTitle')}
                                </p>
                                <p className="text-xs text-foreground-muted leading-relaxed">
                                    {t('featureWalkthroughsDesc')}
                                </p>
                            </div>
                            <div className="flex-1 p-5 text-left border-l border-border">
                                <Users className="h-5 w-5 text-foreground-muted mb-3" />
                                <p className="text-sm font-medium text-foreground mb-1">
                                    {t('featureTeamTitle')}
                                </p>
                                <p className="text-xs text-foreground-muted leading-relaxed">
                                    {t('featureTeamDesc')}
                                </p>
                            </div>
                            <div className="flex-1 p-5 text-left border-l border-border">
                                <Keyboard className="h-5 w-5 text-foreground-muted mb-3" />
                                <p className="text-sm font-medium text-foreground mb-1">
                                    {t('featureShortcutsTitle')}
                                </p>
                                <p className="text-xs text-foreground-muted leading-relaxed">
                                    {t('featureShortcutsDesc')}
                                </p>
                            </div>
                        </div>

                        {/* Open App */}
                        <OnboardingButton onClick={handleOpenApp}>
                            {t('openApp')}
                        </OnboardingButton>
                    </div>
                )}
            </div>

            {/* Bottom dots */}
            <div className="pb-10 pt-6">
                <StepDots current={currentStepIndex} total={ALL_STEPS.length} />
            </div>
        </div>
    );
}
