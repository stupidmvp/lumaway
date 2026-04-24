'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useGenerateWalkthroughsFromLumen, useLumenReview, useReprocessLumen } from '@luma/infra';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

interface LumenReviewPanelProps {
    projectId: string;
    lumenId: string;
}

const VIDEO_STAGE_HEIGHT_CLASS = 'h-[250px] md:h-[320px]';

type ProcessingLogState = 'done' | 'running' | 'pending' | 'error';

interface ProcessingLogEntry {
    id: string;
    label: string;
    detail?: string;
    state: ProcessingLogState;
    at?: string | null;
}

function formatVideoTime(seconds: number) {
    const safe = Math.max(0, seconds);
    const mins = Math.floor(safe / 60);
    const secs = Math.floor(safe % 60);
    const ms = Math.floor((safe - Math.floor(safe)) * 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${ms}`;
}

function formatLogTime(iso?: string | null) {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).format(date);
}

export function LumenReviewPanel({ projectId, lumenId }: LumenReviewPanelProps) {
    const t = useTranslations('LumenReview');
    const router = useRouter();
    const { data, isLoading, isError, refetch, isFetching } = useLumenReview(lumenId);
    const generateMutation = useGenerateWalkthroughsFromLumen();
    const reprocessMutation = useReprocessLumen();
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [activeStepId, setActiveStepId] = useState<string | null>(null);
    const [isVideoLoading, setIsVideoLoading] = useState(true);

    const canGenerate = useMemo(() => {
        const status = data?.session?.status;
        return status === 'ready_for_review';
    }, [data?.session?.status]);

    useEffect(() => {
        const status = data?.session?.status;
        if (status !== 'uploaded' && status !== 'processing') return;
        const timer = setInterval(() => {
            refetch();
        }, 2500);
        return () => clearInterval(timer);
    }, [data?.session?.status, refetch]);

    useEffect(() => {
        setIsVideoLoading(Boolean(data?.videoUrl));
    }, [data?.videoUrl]);

    const durationSec = useMemo(() => {
        if (!data) return 1;
        const { session, chapters, stepCandidates } = data;
        const fromSession = typeof session.videoDurationMs === 'number' && session.videoDurationMs > 0
            ? session.videoDurationMs / 1000
            : 0;
        const fromChapters = chapters.length > 0 ? Math.max(...chapters.map((c) => c.endMs / 1000)) : 0;
        const fromSteps = stepCandidates.length > 0 ? Math.max(...stepCandidates.map((s) => s.timestampMs / 1000)) : 0;
        return Math.max(fromSession, fromChapters, fromSteps, 1);
    }, [data]);

    const transcriptSummary = useMemo(() => {
        const raw = data?.session?.processingSummary?.transcript as Record<string, any> | undefined;
        if (!raw || typeof raw !== 'object') return null;
        const reason = typeof raw.reason === 'string' ? raw.reason : null;
        const details = typeof raw.details === 'string' ? raw.details : null;
        const status = typeof raw.status === 'string' ? raw.status : null;
        const reasonLabel = reason === 'missing_openai_api_key'
            ? 'OPENAI_API_KEY is not configured in API environment.'
            : reason === 'missing_openai_provider_key'
                ? 'No OpenAI key configured at project/org level (tenant_llm_keys) nor OPENAI_API_KEY fallback.'
            : reason === 'local_transcription_error'
                ? (details || 'Local transcription failed. Check ffmpeg/whisper binaries and process env.')
            : reason === 'missing_video_s3_key'
                ? 'No uploaded lumen video found in this session.'
            : reason === 'transcription_error'
                ? (details || 'Audio transcription failed.')
                    : null;
        return {
            provider: typeof raw.provider === 'string' ? raw.provider : null,
            model: typeof raw.model === 'string' ? raw.model : null,
            segmentsCount: typeof raw.segmentsCount === 'number' ? raw.segmentsCount : null,
            preview: typeof raw.preview === 'string' ? raw.preview : null,
            status,
            reason,
            reasonLabel,
        };
    }, [data]);

    const transcriptExtracts = useMemo(() => {
        if (!data) return [] as Array<{ id: string; order: number; timestampMs: number; text: string }>;
        const seenText = new Set<string>();
        const extracts: Array<{ id: string; order: number; timestampMs: number; text: string }> = [];

        const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();
        const isWeakAudioText = (value: string) => {
            const text = normalize(value);
            if (!text) return true;
            const words = text.split(' ').filter(Boolean);
            if (words.length < 4) return true;
            if (/^(luego|despues|después|entonces|y)\b/.test(text)) return true;
            if (/^video\.?$/.test(text)) return true;
            if (/^(tal|ok|vale)\b/.test(text) && words.length <= 6) return true;
            return false;
        };

        for (const step of data.stepCandidates || []) {
            const spokenRaw = (step?.metadata as any)?.spokenExtract;
            const mappedRaw = (step?.metadata as any)?.interactionMap?.transcriptText;
            const snippetRaw = (step?.metadata as any)?.transcriptSnippet;
            const candidateText = typeof spokenRaw === 'string' && spokenRaw.trim()
                ? spokenRaw.trim()
                : typeof mappedRaw === 'string' && mappedRaw.trim()
                ? mappedRaw.trim()
                : typeof snippetRaw === 'string' ? snippetRaw.trim() : '';
            if (!candidateText) continue;
            if (isWeakAudioText(candidateText)) continue;

            const key = normalize(candidateText);
            if (!key) continue;
            if (seenText.has(key)) continue;
            seenText.add(key);

            extracts.push({
                id: String(step.id),
                order: Number(step.order || 0),
                timestampMs: Number(step.timestampMs || 0),
                text: candidateText,
            });
        }
        const sorted = extracts.sort((a, b) => a.timestampMs - b.timestampMs);
        if (sorted.length > 0) return sorted;

        if (transcriptSummary?.preview) {
            return [{
                id: 'transcript-preview-fallback',
                order: 1,
                timestampMs: 0,
                text: transcriptSummary.preview,
            }];
        }

        return sorted;
    }, [data, transcriptSummary?.preview]);

    const timelineTicks = useMemo(() => {
        const slices = 6;
        return Array.from({ length: slices + 1 }).map((_, i) => {
            const sec = (durationSec / slices) * i;
            return {
                id: `tick-${i}`,
                left: `${(i / slices) * 100}%`,
                label: formatVideoTime(sec),
            };
        });
    }, [durationSec]);

    const session = data?.session!;
    const chapters = data?.chapters ?? [];
    const stepCandidates = data?.stepCandidates ?? [];
    const isRegenerating = session?.status === 'uploaded' || session?.status === 'processing';
    const showSkeletons = isRegenerating || isFetching;
    const processingSummary = (session?.processingSummary || {}) as Record<string, any>;
    const transcriptState = (processingSummary.transcript || {}) as Record<string, any>;
    const transcriptStatus = String(transcriptState.status || '').toLowerCase();
    const chapterCount = Number(processingSummary.chapterCount || chapters.length || 0);
    const stepCount = Number(processingSummary.stepCandidatesCount || stepCandidates.length || 0);

    const processingPhase = useMemo(() => {
        if (!session) return 0;
        if (session.status === 'failed') return 6;
        if (session.status === 'ready_for_review') return 6;
        if (session.status === 'uploaded') return 1;
        if (session.status !== 'processing') return 0;

        if (stepCount > 0) return 5;
        if (chapterCount > 0) return 4;
        if (transcriptStatus === 'ok' || transcriptStatus === 'completed' || transcriptStatus === 'success') return 3;
        return 2;
    }, [chapterCount, session, stepCount, transcriptStatus]);

    const processingLogEntries = useMemo<ProcessingLogEntry[]>(() => {
        if (!session) return [];

        const entries: ProcessingLogEntry[] = [];
        const transcriptReason = typeof transcriptState.reason === 'string' ? transcriptState.reason : null;
        const transcriptDetail = typeof transcriptState.details === 'string' ? transcriptState.details : null;
        const transcriptProvider = typeof transcriptState.provider === 'string' ? transcriptState.provider : null;
        const transcriptModel = typeof transcriptState.model === 'string' ? transcriptState.model : null;
        const transcriptFailed = transcriptStatus === 'error' || transcriptStatus === 'failed';

        entries.push({
            id: 'upload',
            label: t('log.uploadReceived'),
            detail: `${t('source')}: ${t(`captureSource.${session.captureSource || 'unknown'}`)}`,
            state: session.status === 'recording' || session.status === 'cancelled' ? 'pending' : 'done',
            at: session.endedAt || session.updatedAt,
        });

        if (processingSummary.reprocessRequestedAt) {
            entries.push({
                id: 'reprocess-requested',
                label: t('log.reprocessRequested'),
                state: 'done',
                at: String(processingSummary.reprocessRequestedAt),
            });
        }

        entries.push({
            id: 'queue',
            label: t('log.queued'),
            detail: t('log.queuedDetail'),
            state: processingPhase > 1 ? 'done' : processingPhase === 1 ? 'running' : 'pending',
            at: session.updatedAt,
        });

        let transcriptionStepState: ProcessingLogState = 'pending';
        if (transcriptFailed || session.status === 'failed') transcriptionStepState = 'error';
        else if (processingPhase > 2) transcriptionStepState = 'done';
        else if (processingPhase === 2) transcriptionStepState = 'running';

        const transcriptMeta = [transcriptProvider, transcriptModel].filter(Boolean).join(' · ');
        const transcriptExtra = transcriptReason || transcriptDetail || null;
        entries.push({
            id: 'transcription',
            label: t('log.transcription'),
            detail: [transcriptMeta, transcriptExtra].filter(Boolean).join(' · ') || undefined,
            state: transcriptionStepState,
            at: session.updatedAt,
        });

        entries.push({
            id: 'chapters',
            label: t('log.chapters'),
            detail: t('log.chaptersCount', { count: chapterCount }),
            state: session.status === 'failed'
                ? (chapterCount > 0 ? 'done' : 'error')
                : processingPhase > 3
                    ? 'done'
                    : processingPhase === 3
                        ? 'running'
                        : 'pending',
            at: session.updatedAt,
        });

        entries.push({
            id: 'steps',
            label: t('log.steps'),
            detail: t('log.stepsCount', { count: stepCount }),
            state: session.status === 'failed'
                ? (stepCount > 0 ? 'done' : 'error')
                : processingPhase > 4
                    ? 'done'
                    : processingPhase === 4
                        ? 'running'
                        : 'pending',
            at: session.updatedAt,
        });

        entries.push({
            id: 'final',
            label: session.status === 'failed' ? t('log.failed') : t('log.completed'),
            detail: session.status === 'failed'
                ? String(processingSummary.error || t('log.failedDetail'))
                : t('log.completedDetail'),
            state: session.status === 'failed'
                ? 'error'
                : processingPhase === 6
                    ? 'done'
                    : processingPhase === 5
                        ? 'running'
                        : 'pending',
            at: String(processingSummary.failedAt || processingSummary.processedAt || session.updatedAt || ''),
        });

        return entries;
    }, [
        chapterCount,
        processingPhase,
        processingSummary.error,
        processingSummary.failedAt,
        processingSummary.processedAt,
        processingSummary.reprocessRequestedAt,
        session,
        stepCount,
        t,
        transcriptState.details,
        transcriptState.model,
        transcriptState.provider,
        transcriptState.reason,
        transcriptStatus,
    ]);

    const visibleProcessingLogEntries = useMemo(() => {
        if (processingLogEntries.length === 0) return processingLogEntries;
        const firstNonDone = processingLogEntries.findIndex((entry) => entry.state !== 'done');
        if (firstNonDone === -1) return processingLogEntries;
        return processingLogEntries.slice(0, firstNonDone + 1);
    }, [processingLogEntries]);

    if (isLoading) {
        return (
            <div className="flex-1 overflow-y-auto bg-background min-w-0">
                <div className="w-full max-w-5xl px-6 py-5 mx-auto space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-4 w-72" />
                        </div>
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-8 w-28" />
                            <Skeleton className="h-8 w-24" />
                            <Skeleton className="h-8 w-36" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={`meta-skeleton-${i}`} className="rounded-lg border border-border p-3 bg-background-secondary">
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="h-5 w-20 mt-2" />
                            </div>
                        ))}
                    </div>
                    <div className="rounded-lg border border-border bg-background p-4 space-y-3">
                        <Skeleton className="h-5 w-36" />
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            <div className="md:col-span-4 rounded-md border border-border bg-background-secondary p-3 space-y-3">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={`step-skeleton-${i}`} className="space-y-2">
                                        <Skeleton className="h-4 w-5/6" />
                                        <Skeleton className="h-3 w-full" />
                                        <Skeleton className="h-3 w-2/3" />
                                    </div>
                                ))}
                            </div>
                            <div className="md:col-span-8 space-y-3">
                                <Skeleton className={`${VIDEO_STAGE_HEIGHT_CLASS} w-full rounded-md`} />
                                <Skeleton className="h-9 w-full rounded-full" />
                                <Skeleton className="h-4 w-full rounded-md" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="p-6">
                <p className="text-sm text-destructive">{t('loadFailed')}</p>
            </div>
        );
    }

    const seekTo = async (seconds: number, options?: { autoplay?: boolean; stepId?: string }) => {
        const video = videoRef.current;
        if (!video) return;
        const targetSeconds = Math.max(0, Math.min(seconds, durationSec));
        const autoplay = options?.autoplay ?? true;
        if (options?.stepId) setActiveStepId(options.stepId);

        const applySeek = () => {
            video.currentTime = targetSeconds;
            if (autoplay) {
                video.play().catch(() => undefined);
            } else {
                video.pause();
            }
        };

        if (video.readyState >= 1) {
            applySeek();
            return;
        }

        const onLoaded = () => {
            applySeek();
            video.removeEventListener('loadedmetadata', onLoaded);
        };
        video.addEventListener('loadedmetadata', onLoaded);
    };

    return (
        <div className="flex-1 overflow-y-auto bg-background min-w-0">
            <div className="w-full max-w-5xl px-6 py-5 mx-auto">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-semibold text-foreground">{t('title')}</h1>
                        <p className="text-sm text-foreground-muted mt-1">
                            {session.intent || t('withoutIntent')}
                        </p>
                        {isRegenerating && (
                            <p className="text-xs text-amber-400 mt-1 flex items-center gap-1.5">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {t('reprocessInProgress')}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href={`/projects/${projectId}/settings`}>
                        <Button variant="outline" size="sm">{t('backToSettings')}</Button>
                        </Link>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={reprocessMutation.isPending || isRegenerating}
                            onClick={async () => {
                                try {
                                    await reprocessMutation.mutateAsync({ observerSessionId: lumenId });
                                    toast.success(t('reprocessQueued'));
                                    refetch();
                                } catch {
                                    toast.error(t('reprocessFailed'));
                                }
                            }}
                        >
                            {(reprocessMutation.isPending || isFetching) && isRegenerating ? t('regenerating') : t('regenerate')}
                        </Button>
                        <Button
                            size="sm"
                            disabled={!canGenerate || generateMutation.isPending || isRegenerating}
                            onClick={async () => {
                                try {
                                    const res = await generateMutation.mutateAsync({
                                        observerSessionId: lumenId,
                                        mode: 'single',
                                    });
                                    toast.success(t('generated', { count: res.createdWalkthroughs.length }));
                                    const firstWalkthroughId = res.createdWalkthroughs[0]?.walkthroughId;
                                    if (firstWalkthroughId) {
                                        router.push(`/walkthroughs/${firstWalkthroughId}`);
                                    }
                                } catch {
                                    toast.error(t('generateFailed'));
                                }
                            }}
                        >
                            {t('generateSingle')}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!canGenerate || generateMutation.isPending || isRegenerating}
                            onClick={async () => {
                                try {
                                    const res = await generateMutation.mutateAsync({
                                        observerSessionId: lumenId,
                                        mode: 'perChapter',
                                    });
                                    toast.success(t('generated', { count: res.createdWalkthroughs.length }));
                                    const firstWalkthroughId = res.createdWalkthroughs[0]?.walkthroughId;
                                    if (firstWalkthroughId) {
                                        router.push(`/walkthroughs/${firstWalkthroughId}`);
                                    }
                                } catch {
                                    toast.error(t('generateFailed'));
                                }
                            }}
                        >
                            {t('generatePerChapter')}
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                    <div className="rounded-lg border border-border p-3 bg-background-secondary">
                        <p className="text-xs text-foreground-muted">{t('status')}</p>
                        {showSkeletons ? (
                            <Skeleton className="h-5 w-24 mt-1" />
                        ) : (
                            <p className="text-sm font-medium text-foreground mt-1">{session.status}</p>
                        )}
                    </div>
                    <div className="rounded-lg border border-border p-3 bg-background-secondary">
                        <p className="text-xs text-foreground-muted">{t('source')}</p>
                        {showSkeletons ? (
                            <Skeleton className="h-5 w-28 mt-1" />
                        ) : (
                            <p className="text-sm font-medium text-foreground mt-1">
                                {t(`captureSource.${session.captureSource || 'unknown'}`)}
                            </p>
                        )}
                    </div>
                    {!isRegenerating && (
                        <div className="rounded-lg border border-border p-3 bg-background-secondary">
                            <p className="text-xs text-foreground-muted">{t('chapters')}</p>
                            {showSkeletons ? <Skeleton className="h-5 w-10 mt-1" /> : <p className="text-sm font-medium text-foreground mt-1">{chapters.length}</p>}
                        </div>
                    )}
                    <div className="rounded-lg border border-border p-3 bg-background-secondary">
                        <p className="text-xs text-foreground-muted">{t('steps')}</p>
                        {showSkeletons ? <Skeleton className="h-5 w-10 mt-1" /> : <p className="text-sm font-medium text-foreground mt-1">{stepCandidates.length}</p>}
                    </div>
                </div>

                {(isRegenerating || session.status === 'failed') && (
                    <div className="rounded-lg border border-border bg-background mb-4">
                        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-foreground">{t('log.title')}</h2>
                            <span className="text-[11px] text-foreground-subtle">{t('log.live')}</span>
                        </div>
                        <div className="px-4 py-3">
                            <div className="rounded-md border border-border bg-background-secondary/40 overflow-hidden">
                                {visibleProcessingLogEntries.map((entry, index) => {
                                    const at = formatLogTime(entry.at);
                                    const isLast = index === visibleProcessingLogEntries.length - 1;

                                    return (
                                        <div
                                            key={entry.id}
                                            className={`flex items-start gap-3 px-3 py-2.5 ${!isLast ? 'border-b border-border/70' : ''}`}
                                        >
                                            <div className="mt-0.5 shrink-0">
                                                {entry.state === 'done' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                                                {entry.state === 'running' && <Loader2 className="h-4 w-4 text-accent-blue animate-spin" />}
                                                {entry.state === 'error' && <AlertTriangle className="h-4 w-4 text-destructive" />}
                                                {entry.state === 'pending' && <Circle className="h-4 w-4 text-foreground-subtle" />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="text-xs font-medium text-foreground">{entry.label}</p>
                                                    {at && (
                                                        <span className="text-[10px] text-foreground-subtle font-mono shrink-0">{at}</span>
                                                    )}
                                                </div>
                                                {entry.detail && (
                                                    <p className="text-[11px] text-foreground-muted mt-0.5 break-words">
                                                        {entry.detail}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {!isRegenerating && (
                <div className="rounded-lg border border-border bg-background mb-4">
                    <div className="px-4 py-3 border-b border-border">
                        <h2 className="text-sm font-semibold text-foreground">{t('videoAndTimeline')}</h2>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-4 rounded-md border border-border bg-background-secondary">
                            <div className="px-3 py-2 border-b border-border">
                                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">{t('stepCandidates')}</h3>
                            </div>
                            <div className="divide-y divide-border max-h-[440px] overflow-y-auto">
                                {showSkeletons && stepCandidates.length === 0 && (
                                    <div className="px-3 py-3 space-y-3">
                                        {Array.from({ length: 6 }).map((_, i) => (
                                            <div key={`step-candidate-skeleton-${i}`} className="space-y-2">
                                                <Skeleton className="h-4 w-4/5" />
                                                <Skeleton className="h-3 w-full" />
                                                <Skeleton className="h-3 w-2/3" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {stepCandidates.length === 0 && (
                                    <p className="text-sm text-foreground-muted px-3 py-4">{t('noSteps')}</p>
                                )}
                                {stepCandidates.map((step) => (
                                    <button
                                        key={step.id}
                                        type="button"
                                        className={`px-3 py-3 w-full text-left transition-colors ${activeStepId === step.id ? 'bg-accent-blue/10' : 'hover:bg-background'}`}
                                        onClick={() => seekTo(step.timestampMs / 1000, { autoplay: false, stepId: step.id })}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-medium text-foreground">{step.order}. {step.title}</p>
                                            <span className="text-[11px] text-foreground-muted">
                                                {formatVideoTime(step.timestampMs / 1000)} · {step.confidence}%
                                            </span>
                                        </div>
                                        <p className="text-xs text-foreground-muted mt-1">{step.description}</p>
                                        <p className="text-[11px] text-foreground-subtle mt-1">
                                            {step.targetSelector || t('manualTargetRequired')}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>

                            <div className="md:col-span-8 space-y-3">
                            {showSkeletons && !data.videoUrl ? (
                                <>
                                    <div className={`${VIDEO_STAGE_HEIGHT_CLASS} w-full rounded-md border border-border overflow-hidden`}>
                                        <Skeleton className="h-full w-full rounded-none" />
                                    </div>
                                    <Skeleton className="h-9 w-full rounded-full" />
                                    <Skeleton className="h-4 w-full rounded-md" />
                                </>
                            ) : data.videoUrl ? (
                                <>
                                    <div className={`${VIDEO_STAGE_HEIGHT_CLASS} relative w-full rounded-md border border-border bg-black overflow-hidden`}>
                                        {isVideoLoading && (
                                            <div className="absolute inset-0 z-10">
                                                <Skeleton className="h-full w-full rounded-none" />
                                            </div>
                                        )}
                                        <video
                                            ref={videoRef}
                                            src={data.videoUrl}
                                            controls
                                            className={`h-full w-full object-contain transition-opacity ${isVideoLoading ? 'opacity-0' : 'opacity-100'}`}
                                            onTimeUpdate={(e) => setCurrentTime((e.currentTarget as HTMLVideoElement).currentTime)}
                                            onLoadedData={() => setIsVideoLoading(false)}
                                            onPlaying={() => setIsVideoLoading(false)}
                                            onWaiting={() => setIsVideoLoading(true)}
                                        />
                                    </div>
                                        <div className="space-y-2">
                                            <div className="relative h-9 rounded-full bg-background-secondary border border-border overflow-hidden">
                                                {chapters.map((chapter) => {
                                                    const left = (chapter.startMs / 1000 / durationSec) * 100;
                                                    const width = Math.max(2.5, ((chapter.endMs - chapter.startMs) / 1000 / durationSec) * 100);
                                                    const active = currentTime >= chapter.startMs / 1000 && currentTime <= chapter.endMs / 1000;
                                                    return (
                                                        <button
                                                            key={chapter.id}
                                                            type="button"
                                                            title={`${chapter.title} (${formatVideoTime(chapter.startMs / 1000)})`}
                                                            className={`absolute top-0 h-full border-r border-background/40 transition-colors ${active ? 'bg-accent-blue/50' : 'bg-accent-blue/25 hover:bg-accent-blue/35'}`}
                                                            style={{ left: `${left}%`, width: `${width}%` }}
                                                            onClick={() => seekTo(chapter.startMs / 1000)}
                                                        >
                                                        {width > 14 && (
                                                            <span className="absolute inset-0 flex items-center px-2 text-[10px] font-medium text-foreground/90 truncate">
                                                                {chapter.title}
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                            <div
                                                className="absolute left-0 top-0 h-full bg-accent-blue/10 pointer-events-none"
                                                style={{ width: `${Math.min(100, Math.max(0, (currentTime / durationSec) * 100))}%` }}
                                            />
                                            <div
                                                className="absolute top-0 h-full w-[2px] bg-white/90 shadow-[0_0_0_1px_rgba(15,23,42,0.35)] pointer-events-none -translate-x-1/2"
                                                style={{ left: `${Math.min(100, Math.max(0, (currentTime / durationSec) * 100))}%` }}
                                            />
                                        </div>

                                        <div className="relative h-4 rounded-md bg-background-secondary/80 border border-border overflow-hidden">
                                            {stepCandidates.map((step) => {
                                                const left = (step.timestampMs / 1000 / durationSec) * 100;
                                                const isActive = activeStepId === step.id || Math.abs((step.timestampMs / 1000) - currentTime) < 0.5;
                                                return (
                                                    <button
                                                        key={step.id}
                                                        type="button"
                                                        title={`${step.order}. ${step.title} (${formatVideoTime(step.timestampMs / 1000)})`}
                                                        className={`absolute top-1/2 -translate-y-1/2 h-2 rounded-full transition-colors ${isActive ? 'bg-amber-300 w-5' : 'bg-amber-500/90 hover:bg-amber-400 w-3'}`}
                                                        style={{ left: `calc(${left}% - 6px)` }}
                                                        onClick={() => seekTo(step.timestampMs / 1000, { autoplay: false, stepId: step.id })}
                                                    />
                                                );
                                            })}
                                        </div>

                                        <div className="relative h-5">
                                            {timelineTicks.map((tick) => (
                                                <div
                                                    key={tick.id}
                                                    className="absolute top-0 -translate-x-1/2 text-[10px] text-foreground-subtle"
                                                    style={{ left: tick.left }}
                                                >
                                                    <div className="mx-auto h-1.5 w-px bg-border mb-0.5" />
                                                    {tick.label}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className={`${VIDEO_STAGE_HEIGHT_CLASS} w-full rounded-md border border-border bg-background-secondary flex items-center justify-center px-4`}>
                                    <p className="text-sm text-foreground-muted">{t('noVideoAvailable')}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                )}

                {!isRegenerating && (
                <div className="rounded-lg border border-border bg-background mb-4">
                    <div className="px-4 py-3 border-b border-border">
                        <h2 className="text-sm font-semibold text-foreground">{t('chapters')}</h2>
                    </div>
                    <div className="divide-y divide-border">
                        {showSkeletons && chapters.length === 0 && (
                            <div className="px-4 py-3 space-y-3">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <div key={`chapters-skeleton-${i}`} className="space-y-2">
                                        <Skeleton className="h-4 w-1/2" />
                                        <Skeleton className="h-3 w-4/5" />
                                    </div>
                                ))}
                            </div>
                        )}
                        {chapters.length === 0 && (
                            <p className="text-sm text-foreground-muted px-4 py-4">{t('noChapters')}</p>
                        )}
                        {chapters.map((chapter) => (
                            <button
                                key={chapter.id}
                                type="button"
                                className="px-4 py-3 w-full text-left hover:bg-background-secondary transition-colors"
                                onClick={() => seekTo(chapter.startMs / 1000)}
                            >
                                <p className="text-sm font-medium text-foreground">{chapter.title}</p>
                                <p className="text-xs text-foreground-muted mt-1">
                                    {formatVideoTime(chapter.startMs / 1000)} - {formatVideoTime(chapter.endMs / 1000)}
                                    {chapter.summary ? ` · ${chapter.summary}` : ''}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>
                )}

                <div className="rounded-lg border border-border bg-background mb-4">
                    <div className="px-4 py-3 border-b border-border">
                        <h2 className="text-sm font-semibold text-foreground">{t('audioExtracts')}</h2>
                    </div>
                    <div className="p-4 space-y-3">
                        {showSkeletons && transcriptExtracts.length === 0 && (
                            <div className="rounded-md border border-border p-3 space-y-3">
                                <Skeleton className="h-3 w-1/2" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-5/6" />
                            </div>
                        )}
                        {transcriptSummary && (
                            <div className="rounded-md border border-border bg-background-secondary p-3">
                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-foreground-muted">
                                    {transcriptSummary.provider && <span>{t('transcriptProvider')}: {transcriptSummary.provider}</span>}
                                    {transcriptSummary.model && <span>· {t('transcriptModel')}: {transcriptSummary.model}</span>}
                                    {typeof transcriptSummary.segmentsCount === 'number' && (
                                        <span>· {t('transcriptSegments')}: {transcriptSummary.segmentsCount}</span>
                                    )}
                                </div>
                                {transcriptSummary.preview && (
                                    <p className="text-xs text-foreground mt-2">{transcriptSummary.preview}</p>
                                )}
                            </div>
                        )}

                        {transcriptExtracts.length === 0 && (
                            <div className="space-y-1">
                                <p className="text-sm text-foreground-muted">{t('noAudioExtracts')}</p>
                                {transcriptSummary?.reasonLabel && (
                                    <p className="text-xs text-amber-400">{transcriptSummary.reasonLabel}</p>
                                )}
                            </div>
                        )}

                        {transcriptExtracts.length > 0 && (
                            <div className="rounded-md border border-border divide-y divide-border">
                                {transcriptExtracts.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className="w-full text-left px-3 py-2.5 hover:bg-background-secondary transition-colors"
                                        onClick={() => seekTo(item.timestampMs / 1000, { autoplay: false })}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-xs font-medium text-foreground">
                                                Step {item.order}
                                            </p>
                                            <span className="text-[11px] text-foreground-muted">
                                                {formatVideoTime(item.timestampMs / 1000)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-foreground-muted mt-1">{item.text}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
