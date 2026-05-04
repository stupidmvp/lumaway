'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useGenerateWalkthroughsFromLumen, useLumenReview, useReprocessLumen, useSaveLumenTranscriptSegments, useSaveReview } from '@luma/infra';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertTriangle, Captions, CheckCircle2, Circle, Loader2, Magnet, MousePointer2, Pause, Play, Redo2, RotateCcw, Scissors, Settings2, Undo2, Wand2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CapcutTimeline } from './CapcutTimeline';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { LumenVideoPlayer } from '../shared/video/LumenVideoPlayer';
import { LumenTimeline } from '../shared/video/LumenTimeline';

interface LumenReviewPanelProps {
    projectId: string;
    lumenId: string;
}

const VIDEO_STAGE_HEIGHT_CLASS = 'aspect-video w-full';

type ProcessingLogState = 'done' | 'running' | 'pending' | 'error';

interface ProcessingLogEntry {
    id: string;
    label: string;
    detail?: string;
    state: ProcessingLogState;
    at?: string | null;
}

interface ReviewTimelineStep {
    id: string;
    order: number;
    title: string;
    description: string;
    targetSelector?: string | null;
    timestampMs: number;
    confidence: number;
}

interface VideoTextWord {
    text: string;
    startMs: number;
    endMs: number;
}

interface VideoTextSegment {
    id: string;
    order: number;
    startMs: number;
    endMs: number;
    text: string;
    words?: VideoTextWord[];
}

function formatVideoTime(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00.0';
    const safe = seconds;
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
    const saveTranscriptSegmentsMutation = useSaveLumenTranscriptSegments();
    const saveReviewMutation = useSaveReview();
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [activeStepId, setActiveStepId] = useState<string | null>(null);
    const [isVideoLoading, setIsVideoLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);

    const togglePlayback = useCallback(() => {
        if (!videoRef.current) return;
        if (videoRef.current.paused) {
            videoRef.current.play().catch(() => undefined);
        } else {
            videoRef.current.pause();
        }
    }, []);

    const [subtitleSegments, setSubtitleSegments] = useState<VideoTextSegment[]>([]);
    const [selectedSubtitleSegmentId, setSelectedSubtitleSegmentId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('steps');
    const [videoDuration, setVideoDuration] = useState<number | null>(null);
    const [showSubtitles, setShowSubtitles] = useState(true);
    const [playbackRate, setPlaybackRate] = useState(1);
    const stepsListRef = useRef<HTMLDivElement>(null);

    const [pastSteps, setPastSteps] = useState<ReviewTimelineStep[][]>([]);
    const [presentSteps, setPresentSteps] = useState<ReviewTimelineStep[]>([]);
    const [futureSteps, setFutureSteps] = useState<ReviewTimelineStep[][]>([]);
    const [isStepsInitialized, setIsStepsInitialized] = useState(false);
    const lastHistoryPushTime = useRef<number>(0);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.playbackRate = playbackRate;
        }
    }, [playbackRate, videoRef.current]);

    const activeSegment = useMemo(() => {
        const timeMs = currentTime * 1000;
        return subtitleSegments.find(s => timeMs >= s.startMs && timeMs <= s.endMs);
    }, [subtitleSegments, currentTime]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only trigger if not typing in an input/textarea
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            
            if (e.code === 'Space') {
                e.preventDefault(); // Prevents focused buttons from being clicked
                togglePlayback();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [togglePlayback]);

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
        setIsPlaying(false);
        setCurrentTime(0);
    }, [data?.videoUrl]);

    // 1. Unified Duration Logic (Priority: Video Element > Session Data > Content Max)
    const session = data?.session!;
    const chapters = data?.chapters ?? [];
    const stepCandidates = data?.stepCandidates ?? [];
    
    const durationSec = useMemo(() => {
        // 1. High priority: the actual metadata from the video element
        if (videoDuration && videoDuration > 0) return videoDuration;

        // 2. Medium priority: the duration stored in the session
        const sessionDuration = (session?.videoDurationMs || 0) / 1000;
        if (sessionDuration > 0) return sessionDuration;
        
        // 3. Low priority: the max timestamp of content
        const maxContentSec = Math.max(
            ...(chapters || []).map((c: any) => (c.endMs || 0) / 1000),
            ...(stepCandidates || []).map((s: any) => (s.timestampMs || 0) / 1000),
            0
        );
        return maxContentSec || 0.1; // 0.1 to avoid division by zero
    }, [data, videoDuration, session, chapters, stepCandidates]);

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

    const extractedSubtitleSegments = useMemo<VideoTextSegment[]>(() => {
        const raw = data?.session?.processingSummary?.transcript as Record<string, any> | undefined;
        const segments = Array.isArray(raw?.segments) ? raw.segments as Array<Record<string, any>> : [];
        return segments
            .map((segment, index) => {
                const startMs = Number(segment.startMs ?? segment.start ?? 0);
                const endMs = Number(segment.endMs ?? segment.end ?? startMs);
                const text = String(segment.text || '').replace(/\s+/g, ' ').trim();
                return {
                    id: `subtitle-segment-${index + 1}`,
                    order: index + 1,
                    startMs: Number.isFinite(startMs) ? Math.max(0, startMs) : 0,
                    endMs: Number.isFinite(endMs) ? Math.max(0, endMs) : 0,
                    text,
                    words: Array.isArray(segment.words) ? segment.words : undefined,
                };
            })
            .filter((segment) => segment.text && segment.endMs >= segment.startMs)
            .sort((a, b) => a.startMs - b.startMs);
    }, [data]);

    useEffect(() => {
        setSubtitleSegments(extractedSubtitleSegments);
        setSelectedSubtitleSegmentId(extractedSubtitleSegments[0]?.id ?? null);
    }, [extractedSubtitleSegments]);

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

    const isRegenerating = session?.status === 'uploaded' || session?.status === 'processing';
    const showSkeletons = isRegenerating || isFetching;
    const processingSummary = (session?.processingSummary || {}) as Record<string, any>;
    const actionableExtraction = (processingSummary.actionableExtraction || {}) as Record<string, any>;
    const actionableActions = useMemo(() => (
        Array.isArray(actionableExtraction.actions)
            ? actionableExtraction.actions as Array<Record<string, any>>
            : []
    ), [actionableExtraction.actions]);
    const narratedActionUnits = useMemo(() => (
        Array.isArray(processingSummary.narratedActionUnits)
            ? processingSummary.narratedActionUnits as Array<Record<string, any>>
            : []
    ), [processingSummary.narratedActionUnits]);
    const transcriptState = (processingSummary.transcript || {}) as Record<string, any>;
    const transcriptStatus = String(transcriptState.status || '').toLowerCase();
    const chapterCount = Number(processingSummary.chapterCount || chapters.length || 0);
    const stepCount = Number(processingSummary.stepCandidatesCount || stepCandidates.length || 0);

    const reviewSteps = useMemo<ReviewTimelineStep[]>(() => {
        const actions = actionableActions;
        if (actions.length === 0) {
            return stepCandidates.map((step) => ({
                id: step.id,
                order: step.order,
                title: step.title,
                description: step.description,
                targetSelector: step.targetSelector,
                timestampMs: step.timestampMs,
                confidence: step.confidence,
            }));
        }

        const normalize = (value: unknown) => String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        return actions.map((action, index) => {
            const candidateOrders = Array.isArray(action.sourceCandidateOrders)
                ? action.sourceCandidateOrders.map((value: unknown) => Number(value)).filter(Number.isFinite)
                : [];
            const actionText = normalize(`${action.description || ''} ${action.evidence || ''} ${action.title || ''}`);
            const matchedCandidateByText = stepCandidates.find((candidate) => {
                const candidateText = normalize(`${candidate.description || ''} ${candidate.title || ''}`);
                return candidateText && actionText && (actionText.includes(candidateText) || candidateText.includes(normalize(action.description)));
            });
            const matchedCandidateByOrder = candidateOrders.length > 0
                ? stepCandidates.find((candidate) => candidateOrders.includes(Number(candidate.order)))
                : undefined;
            const matchedCandidate = matchedCandidateByText || matchedCandidateByOrder;
            const matchedNarration = narratedActionUnits.find((unit) => {
                const unitText = normalize(unit.text);
                return unitText && actionText && (unitText.includes(normalize(action.description)) || actionText.includes(unitText));
            });
            const fallbackTimestamp = (durationSec / Math.max(actions.length + 1, 2)) * (index + 1) * 1000;
            const timestampMs = Number(matchedCandidate?.timestampMs)
                || Number(matchedNarration?.startMs)
                || Math.round(fallbackTimestamp);

            return {
                id: matchedCandidate?.id || `suggested-action-${Number(action.order || index + 1)}`,
                order: Number(action.order || index + 1),
                title: String(action.title || matchedCandidate?.title || `Paso ${index + 1}`),
                description: String(action.description || matchedCandidate?.description || ''),
                targetSelector: matchedCandidate?.targetSelector || null,
                timestampMs,
                confidence: matchedCandidate?.confidence ?? 70,
            };
        }).sort((a, b) => a.order - b.order);
    }, [actionableActions, durationSec, narratedActionUnits, stepCandidates]);

    useEffect(() => {
        if (reviewSteps.length > 0 && !isStepsInitialized) {
            setPresentSteps(reviewSteps);
            setIsStepsInitialized(true);
        }
    }, [reviewSteps, isStepsInitialized]);

    useEffect(() => {
        if (!presentSteps.length) return;
        const nearest = presentSteps.reduce<{ id: string; distance: number } | null>((best, step) => {
            const distance = Math.abs((step.timestampMs / 1000) - currentTime);
            if (!best || distance < best.distance) return { id: step.id, distance };
            return best;
        }, null);
        if (nearest && nearest.distance <= 1.25) {
            setActiveStepId(nearest.id);
        }
    }, [currentTime, presentSteps]);

    const handleUpdateStep = useCallback((id: string, patch: Partial<ReviewTimelineStep>) => {
        setPresentSteps((current) => {
            const index = current.findIndex(s => s.id === id);
            if (index === -1) return current;

            const now = Date.now();
            if (now - lastHistoryPushTime.current > 800) {
                setPastSteps(past => [...past, current]);
                setFutureSteps([]);
            }
            lastHistoryPushTime.current = now;

            const next = [...current];
            next[index] = { ...current[index], ...patch };
            return next;
        });
    }, []);

    const undo = useCallback(() => {
        if (pastSteps.length === 0) return;
        
        const previous = pastSteps[pastSteps.length - 1];
        const newPast = pastSteps.slice(0, pastSteps.length - 1);
        
        setPastSteps(newPast);
        setFutureSteps(future => [presentSteps, ...future]);
        setPresentSteps(previous);
    }, [pastSteps, presentSteps]);

    const redo = useCallback(() => {
        if (futureSteps.length === 0) return;
        
        const next = futureSteps[0];
        const newFuture = futureSteps.slice(1);
        
        setPastSteps(past => [...past, presentSteps]);
        setFutureSteps(newFuture);
        setPresentSteps(next);
    }, [futureSteps, presentSteps]);

    useEffect(() => {
        const handleHistoryKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
            }
        };

        window.addEventListener('keydown', handleHistoryKeyDown);
        return () => window.removeEventListener('keydown', handleHistoryKeyDown);
    }, [undo, redo]);

    const activeSubtitleSegment = useMemo(() => {
        const currentMs = currentTime * 1000;
        return subtitleSegments.find((segment) => currentMs >= segment.startMs && currentMs <= segment.endMs) ?? null;
    }, [currentTime, subtitleSegments]);

    const activeSubtitleWords = useMemo(() => {
        if (!activeSubtitleSegment) return [] as Array<{ word: string; active: boolean }>;
        const words = activeSubtitleSegment.text.split(/\s+/).filter(Boolean);
        const duration = Math.max(1, activeSubtitleSegment.endMs - activeSubtitleSegment.startMs);
        const elapsed = Math.min(duration, Math.max(0, (currentTime * 1000) - activeSubtitleSegment.startMs));
        const activeWordCount = Math.min(words.length, Math.max(1, Math.ceil((elapsed / duration) * words.length)));
        return words.map((word, index) => ({ word, active: index < activeWordCount }));
    }, [activeSubtitleSegment, currentTime]);

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

    const progressPercent = useMemo(() => {
        if (!durationSec || durationSec === 0) return 0;
        if (currentTime >= durationSec - 0.1) return 100;
        return Math.min(100, Math.max(0, (currentTime / durationSec) * 100));
    }, [currentTime, durationSec]);

    const seekTo = async (seconds: number, options?: { autoplay?: boolean; stepId?: string }) => {
        const video = videoRef.current;
        if (!video) return;
        const targetSeconds = Math.max(0, Math.min(seconds, durationSec));
        const autoplay = options?.autoplay ?? true;
        if (options?.stepId) setActiveStepId(options.stepId);

        const applySeek = () => {
            setCurrentTime(targetSeconds);
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

    const handleScrub = (value: number) => {
        void seekTo(value, { autoplay: isPlaying });
    };

    const updateSubtitleSegment = (id: string, patch: Partial<VideoTextSegment>) => {
        setSubtitleSegments((segments) => segments.map((segment) => {
            if (segment.id !== id) return segment;
            const next = { ...segment, ...patch };
            const safeStartMs = Math.max(0, Math.min(next.startMs, next.endMs));
            const safeEndMs = Math.max(safeStartMs, next.endMs);
            return {
                ...next,
                startMs: safeStartMs,
                endMs: safeEndMs,
            };
        }));
    };

    const resetSubtitleSegments = () => {
        setSubtitleSegments(extractedSubtitleSegments);
        setSelectedSubtitleSegmentId(extractedSubtitleSegments[0]?.id ?? null);
    };

    const handleSplitSegment = (id: string, splitAtMs: number) => {
        setSubtitleSegments((segments) => {
            const index = segments.findIndex(s => s.id === id);
            const segment = segments[index];
            if (!segment || splitAtMs <= segment.startMs || splitAtMs >= segment.endMs) return segments;

            const seg1: VideoTextSegment = { 
                ...segment, 
                id: segment.id,
                order: segment.order ?? index + 1,
                startMs: segment.startMs ?? 0,
                endMs: splitAtMs 
            };
            const seg2: VideoTextSegment = { 
                ...segment, 
                id: `subtitle-segment-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, 
                order: (segment.order ?? index + 1) + 1,
                startMs: splitAtMs,
                endMs: segment.endMs ?? splitAtMs + 1000
            };
            
            const newSegments = [...segments];
            newSegments.splice(index, 1, seg1, seg2);
            
            return newSegments.map((s, i) => ({ ...s, order: i + 1 }));
        });
    };

    const saveSubtitleSegments = async () => {
        try {
            await saveTranscriptSegmentsMutation.mutateAsync({
                observerSessionId: lumenId,
                processingSummary,
                segments: subtitleSegments.map((segment) => ({
                    startMs: segment.startMs,
                    endMs: segment.endMs,
                    text: segment.text,
                })),
            });
            toast.success(t('segmentsSaved'));
        } catch {
            toast.error(t('segmentsSaveFailed'));
        }
    };

    const handleSaveSteps = async () => {
        try {
            const stepCandidates = presentSteps.map(step => ({
                id: step.id,
                observerSessionId: lumenId,
                order: step.order,
                title: step.title,
                description: step.description,
                targetSelector: step.targetSelector,
                timestampMs: step.timestampMs,
                confidence: step.confidence,
                createdAt: new Date().toISOString(),
            }));
            
            await saveReviewMutation.mutateAsync({
                observerSessionId: lumenId,
                processingSummary,
                subtitleSegments,
                stepCandidates,
            });
            toast.success("Cambios guardados exitosamente");
        } catch {
            toast.error("Error al guardar los cambios");
        }
    };

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
                    <Skeleton className="h-[500px] w-full rounded-lg" />
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

    const selectedSubtitleSegment = subtitleSegments.find((s) => s.id === selectedSubtitleSegmentId) ?? null;

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
                        <p className="text-sm font-medium text-foreground mt-1">{session.status}</p>
                    </div>
                    <div className="rounded-lg border border-border p-3 bg-background-secondary">
                        <p className="text-xs text-foreground-muted">{t('source')}</p>
                        <p className="text-sm font-medium text-foreground mt-1">
                            {t(`captureSource.${session.captureSource || 'unknown'}`)}
                        </p>
                    </div>
                    {!isRegenerating && (
                        <div className="rounded-lg border border-border p-3 bg-background-secondary">
                            <p className="text-xs text-foreground-muted">{t('chapters')}</p>
                            <p className="text-sm font-medium text-foreground mt-1">{chapters.length}</p>
                        </div>
                    )}
                    <div className="rounded-lg border border-border p-3 bg-background-secondary">
                        <p className="text-xs text-foreground-muted">{t('steps')}</p>
                        <p className="text-sm font-medium text-foreground mt-1">{presentSteps.length}</p>
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
                                        <div key={entry.id} className={`flex items-start gap-3 px-3 py-2.5 ${!isLast ? 'border-b border-border/70' : ''}`}>
                                            <div className="mt-0.5 shrink-0">
                                                {entry.state === 'done' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                                                {entry.state === 'running' && <Loader2 className="h-4 w-4 text-accent-blue animate-spin" />}
                                                {entry.state === 'error' && <AlertTriangle className="h-4 w-4 text-destructive" />}
                                                {entry.state === 'pending' && <Circle className="h-4 w-4 text-foreground-subtle" />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="text-xs font-medium text-foreground">{entry.label}</p>
                                                    {at && <span className="text-[10px] text-foreground-subtle font-mono shrink-0">{at}</span>}
                                                </div>
                                                {entry.detail && <p className="text-[11px] text-foreground-muted mt-0.5 break-words">{entry.detail}</p>}
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
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start p-4">
                            <div className="md:col-span-9 flex flex-col gap-4">
                                {data.videoUrl ? (
                                    <LumenVideoPlayer
                                        ref={videoRef}
                                        videoUrl={data.videoUrl}
                                        isVideoLoading={isVideoLoading}
                                        isPlaying={isPlaying}
                                        currentTime={currentTime}
                                        durationSec={durationSec}
                                        playbackRate={playbackRate}
                                        showSubtitles={showSubtitles}
                                        subtitleSegments={subtitleSegments}
                                        activeSegment={activeSegment}
                                        onTogglePlayback={togglePlayback}
                                        onToggleSubtitles={() => setShowSubtitles(!showSubtitles)}
                                        onPlaybackRateChange={setPlaybackRate}
                                        onTimeUpdate={setCurrentTime}
                                        onLoadedMetadata={setVideoDuration}
                                        onLoadedData={() => setIsVideoLoading(false)}
                                        onCanPlay={() => setIsVideoLoading(false)}
                                        onPlay={() => setIsPlaying(true)}
                                        onPause={() => setIsPlaying(false)}
                                        onEnded={(finalTime) => {
                                            setIsPlaying(false);
                                            if (finalTime > 0) setVideoDuration(finalTime);
                                        }}
                                        formatTime={formatVideoTime}
                                        renderTimeline={() => (
                                            <LumenTimeline
                                                durationSec={durationSec}
                                                currentTime={currentTime}
                                                progressPercent={progressPercent}
                                                reviewSteps={presentSteps}
                                                activeStepId={activeStepId}
                                                onSeek={(sec) => seekTo(sec, { autoplay: isPlaying })}
                                                onScrub={handleScrub}
                                                onSelectStep={(id) => {
                                                    const step = presentSteps.find(s => s.id === id);
                                                    if (step) {
                                                        seekTo(step.timestampMs / 1000, { autoplay: false, stepId: id });
                                                        setActiveStepId(id);
                                                        setSelectedSubtitleSegmentId(null);
                                                    }
                                                }}
                                            />
                                        )}
                                    />
                                ) : (
                                    <div className={`${VIDEO_STAGE_HEIGHT_CLASS} w-full rounded-md border border-border bg-background-secondary flex items-center justify-center px-4`}>
                                        <p className="text-sm text-foreground-muted">{t('noVideoAvailable')}</p>
                                    </div>
                                )}

                                <div className="rounded-md border border-border bg-[#0f0f0f] overflow-hidden">
                                    <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-[#141414]">
                                        <div className="flex items-center gap-2">
                                            <Captions className="h-4 w-4 text-[#ff7a00]" />
                                            <h3 className="text-[10px] font-bold uppercase tracking-wider text-white/60">Integrated Timeline Editor</h3>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-7 w-7 text-white/40 hover:text-white" 
                                                onClick={undo} 
                                                disabled={pastSteps.length === 0}
                                                title="Undo (Ctrl+Z)"
                                            >
                                                <Undo2 className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-7 w-7 text-white/40 hover:text-white" 
                                                onClick={redo} 
                                                disabled={futureSteps.length === 0}
                                                title="Redo (Ctrl+Shift+Z)"
                                            >
                                                <Redo2 className="h-3.5 w-3.5" />
                                            </Button>

                                            <div className="w-px h-4 bg-white/10 mx-1"></div>

                                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] text-white/40 hover:text-white" onClick={resetSubtitleSegments} disabled={saveTranscriptSegmentsMutation.isPending}>
                                                <RotateCcw className="h-3 w-3 mr-1" />
                                                Reset
                                            </Button>
                                            <Button size="sm" className="h-7 px-2 text-[10px] bg-[#ff7a00] hover:bg-[#ff7a00]/90 text-white border-none" onClick={() => {
                                                saveSubtitleSegments();
                                                handleSaveSteps();
                                            }} disabled={saveTranscriptSegmentsMutation.isPending || saveReviewMutation.isPending}>
                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                                {(saveTranscriptSegmentsMutation.isPending || saveReviewMutation.isPending) ? "Saving..." : "Save Changes"}
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="h-[300px]">
                                        <CapcutTimeline
                                            durationSec={durationSec}
                                            currentTimeSec={currentTime}
                                            segments={subtitleSegments}
                                            steps={presentSteps.map(s => ({
                                                id: s.id,
                                                order: s.order,
                                                startMs: s.timestampMs,
                                                endMs: Math.min((durationSec || 10) * 1000, s.timestampMs + 8000),
                                                text: s.title,
                                                description: s.description
                                            }))}
                                            selectedSegmentId={selectedSubtitleSegmentId || activeStepId}
                                            onSeek={(sec) => seekTo(sec, { autoplay: false })}
                                            onUpdateSegment={updateSubtitleSegment}
                                            onSelectSegment={(id) => {
                                                const segment = subtitleSegments.find(s => s.id === id);
                                                if (segment) {
                                                    seekTo(segment.startMs / 1000, { autoplay: false });
                                                }
                                                setSelectedSubtitleSegmentId(id);
                                                setActiveStepId(null);
                                            }}
                                            onSelectStep={(id) => {
                                                const step = presentSteps.find(s => s.id === id);
                                                if (step) {
                                                    seekTo(step.timestampMs / 1000, { autoplay: false, stepId: id });
                                                    setActiveStepId(id);
                                                    setSelectedSubtitleSegmentId(null);
                                                }
                                            }}
                                            onUpdateStep={(id, patch) => {
                                                handleUpdateStep(id, { timestampMs: patch.startMs });
                                            }}
                                            videoRef={videoRef}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="md:col-span-3 flex flex-col gap-4 md:sticky md:top-4 max-h-[calc(100vh-100px)] overflow-y-auto">
                                <div className="rounded-lg border border-border bg-background-secondary overflow-hidden">
                                    <div className="px-4 py-3 border-b border-border bg-background/50">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/70">Properties</h3>
                                    </div>
                                    <div className="p-4">
                                        {selectedSubtitleSegment ? (
                                            <div className="space-y-6">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Captions className="h-5 w-5 text-[#ff7a00]" />
                                                    <h3 className="text-sm font-semibold">Edit Subtitle</h3>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[10px] uppercase text-foreground-muted">Start</Label>
                                                        <div className="flex gap-1">
                                                            <div className="flex-1 text-xs font-mono bg-background p-1.5 rounded border border-border tabular-nums">
                                                                {formatVideoTime(selectedSubtitleSegment.startMs / 1000)}
                                                            </div>
                                                            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => updateSubtitleSegment(selectedSubtitleSegment.id, { startMs: Math.round(currentTime * 1000) })}>
                                                                <Magnet className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[10px] uppercase text-foreground-muted">End</Label>
                                                        <div className="flex gap-1">
                                                            <div className="flex-1 text-xs font-mono bg-background p-1.5 rounded border border-border tabular-nums">
                                                                {formatVideoTime(selectedSubtitleSegment.endMs / 1000)}
                                                            </div>
                                                            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => updateSubtitleSegment(selectedSubtitleSegment.id, { endMs: Math.round(currentTime * 1000) })}>
                                                                <Magnet className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] uppercase text-foreground-muted">Text</Label>
                                                    <textarea value={selectedSubtitleSegment.text} onChange={(e) => updateSubtitleSegment(selectedSubtitleSegment.id, { text: e.target.value })} rows={4} className="w-full bg-background border border-border rounded-md p-2.5 text-sm focus:border-[#ff7a00] outline-none resize-none" />
                                                </div>
                                                <div className="flex flex-col gap-2 pt-2">
                                                    <Button variant="outline" className="w-full justify-start text-xs h-8" disabled={currentTime * 1000 <= selectedSubtitleSegment.startMs || currentTime * 1000 >= selectedSubtitleSegment.endMs} onClick={() => handleSplitSegment(selectedSubtitleSegment.id, currentTime * 1000)}>
                                                        <Scissors className="h-3.5 w-3.5 mr-2" />
                                                        Split at Playhead
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : activeStepId ? (
                                            <div className="space-y-6">
                                                {(() => {
                                                    const step = presentSteps.find(s => s.id === activeStepId);
                                                    if (!step) return null;
                                                    return (
                                                        <>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <div className="h-5 w-5 rounded bg-[#3b82f6] flex items-center justify-center text-[10px] text-white font-bold">{step.order}</div>
                                                                <h3 className="text-sm font-semibold">Step Properties</h3>
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <Label className="text-[10px] uppercase text-foreground-muted">Timestamp</Label>
                                                                <div className="flex-1 text-xs font-mono bg-background p-1.5 rounded border border-border tabular-nums">
                                                                    {formatVideoTime(step.timestampMs / 1000)}
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <Label className="text-[10px] uppercase text-foreground-muted">Title</Label>
                                                                <p className="text-sm font-medium text-foreground">{step.title}</p>
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <Label className="text-[10px] uppercase text-foreground-muted">Description</Label>
                                                                <p className="text-xs text-foreground-muted leading-relaxed">{step.description}</p>
                                                            </div>
                                                            <div className="pt-4">
                                                                <Button variant="outline" className="w-full text-xs h-8 mb-2" onClick={() => handleUpdateStep(step.id, { timestampMs: Math.round(currentTime * 1000) })}>
                                                                    <Magnet className="h-3.5 w-3.5 mr-2" />
                                                                    Sync Timestamp to Playhead
                                                                </Button>
                                                                <Button className="w-full text-xs h-8 bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white" onClick={() => seekTo(step.timestampMs / 1000)}>
                                                                    <Play className="h-3 w-3 mr-2" />
                                                                    Go to Moment
                                                                </Button>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 opacity-40">
                                                <MousePointer2 className="h-8 w-8" />
                                                <p className="text-xs">Select an item on the timeline to see properties</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
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
                            {chapters.length === 0 && !showSkeletons && <p className="text-sm text-foreground-muted px-4 py-4">{t('noChapters')}</p>}
                            {chapters.map((chapter) => (
                                <button key={chapter.id} type="button" className="px-4 py-3 w-full text-left hover:bg-background-secondary transition-colors" onClick={() => seekTo(chapter.startMs / 1000)}>
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
                                    {typeof transcriptSummary.segmentsCount === 'number' && <span>· {t('transcriptSegments')}: {transcriptSummary.segmentsCount}</span>}
                                </div>
                                {transcriptSummary.preview && <p className="text-xs text-foreground mt-2">{transcriptSummary.preview}</p>}
                            </div>
                        )}
                        {transcriptExtracts.length === 0 && !showSkeletons && (
                            <div className="space-y-1">
                                <p className="text-sm text-foreground-muted">{t('noAudioExtracts')}</p>
                                {transcriptSummary?.reasonLabel && <p className="text-xs text-amber-400">{transcriptSummary.reasonLabel}</p>}
                            </div>
                        )}
                        {transcriptExtracts.length > 0 && (
                            <div className="rounded-md border border-border divide-y divide-border">
                                {transcriptExtracts.map((item) => (
                                    <button key={item.id} type="button" className="w-full text-left px-3 py-2.5 hover:bg-background-secondary transition-colors" onClick={() => seekTo(item.timestampMs / 1000, { autoplay: false })}>
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-xs font-medium text-foreground">Step {item.order}</p>
                                            <span className="text-[11px] text-foreground-muted">{formatVideoTime(item.timestampMs / 1000)}</span>
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
