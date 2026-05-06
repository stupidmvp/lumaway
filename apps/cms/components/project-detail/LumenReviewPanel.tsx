'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useGenerateWalkthroughsFromLumen, useLumenReview, useMergeLumenSteps, useReprocessLumen, useSaveLumenTranscriptSegments, useSaveReview } from '@luma/infra';
import type { ImperativePanelHandle } from "react-resizable-panels";
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
import { AlertTriangle, Captions, CheckCircle2, ChevronLeft, ChevronRight, Circle, Combine, Hand, Loader2, Magnet, MousePointer2, Move, Pause, Play, Redo2, RotateCcw, RotateCw, Save, Scissors, Settings2, Sparkles, Undo2, Wand2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CapcutTimeline } from './CapcutTimeline';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LumenVideoPlayer } from '../shared/video/LumenVideoPlayer';
import { LumenTimeline } from '../shared/video/LumenTimeline';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Slider } from '@/components/ui/slider';

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
    durationMs?: number;
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
    const mergeStepsMutation = useMergeLumenSteps();

    // Zoom and Pan State
    const [zoom, setZoom] = useState(75);
    const [isPanning, setIsPanning] = useState(false);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const canvasRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const propertiesPanelRef = useRef<ImperativePanelHandle>(null);
    const lastManualSelectionTime = useRef<number>(0);
    const [isPropertiesCollapsed, setIsPropertiesCollapsed] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [activeStepId, setActiveStepId] = useState<string | null>(null);
    const [selectedStepIds, setSelectedStepIds] = useState<Set<string>>(new Set());
    const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
    const [isVideoLoading, setIsVideoLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);

    const togglePlayback = useCallback(() => {
        if (!videoRef.current || isPanning) return;
        if (videoRef.current.paused) {
            videoRef.current.play().catch(() => undefined);
        } else {
            videoRef.current.pause();
        }
    }, [isPanning]);

    const [subtitleSegments, setSubtitleSegments] = useState<VideoTextSegment[]>([]);
    const [selectedSubtitleSegmentId, setSelectedSubtitleSegmentId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('steps');
    const [videoDuration, setVideoDuration] = useState<number | null>(null);
    const [showSubtitles, setShowSubtitles] = useState(true);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [volume, setVolume] = useState(1);
    const [lastVolume, setLastVolume] = useState(1);

    // Force collapse on mount
    useEffect(() => {
        const panel = propertiesPanelRef.current;
        if (panel && !panel.isCollapsed()) {
            panel.collapse();
        }
    }, []);

    const handleVolumeChange = useCallback((val: number) => {
        if (val > 0) setLastVolume(val);
        setVolume(val);
    }, []);
    const stepsListRef = useRef<HTMLDivElement>(null);

    const [pastSteps, setPastSteps] = useState<ReviewTimelineStep[][]>([]);
    const [presentSteps, setPresentSteps] = useState<ReviewTimelineStep[]>([]);
    const [futureSteps, setFutureSteps] = useState<ReviewTimelineStep[][]>([]);
    const [isStepsInitialized, setIsStepsInitialized] = useState(false);
    const lastHistoryPushTime = useRef<number>(0);

    useEffect(() => {
        if (isPanning && videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
        }
    }, [isPanning]);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.playbackRate = playbackRate;
        }
    }, [playbackRate, videoRef.current]);

    const activeSegment = useMemo(() => {
        const timeMs = currentTime * 1000;
        return subtitleSegments.find(s => timeMs >= s.startMs && timeMs <= s.endMs);
    }, [subtitleSegments, currentTime]);


    // Panning logic
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isPanning) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !isPanning) return;
        setPanOffset({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

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
                // CRITICAL: Avoid using 'index' in the ID. Use content or stable properties.
                id: matchedCandidate?.id || `action-${action.order || 'v1'}-${(action.description || '').substring(0, 10).replace(/\s/g, '-')}`,
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
            // Deduplicate by ID just in case
            const unique = reviewSteps.filter((s, i, arr) => arr.findIndex(t => t.id === s.id) === i);
            setPresentSteps(unique);
            setIsStepsInitialized(true);
        }
    }, [reviewSteps, isStepsInitialized]);

    useEffect(() => {
        if (!presentSteps.length || isDraggingTimeline) return;
        
        // Skip auto-selection if a manual click occurred recently
        if (Date.now() - lastManualSelectionTime.current < 1000) return;

        // 1. If a subtitle is manually selected, don't jump to a step if we are still near/in that subtitle
        if (selectedSubtitleSegmentId) {
            const currentSub = subtitleSegments.find(s => s.id === selectedSubtitleSegmentId);
            if (currentSub) {
                const startSec = currentSub.startMs / 1000;
                const endSec = currentSub.endMs / 1000;
                if (currentTime >= startSec - 0.2 && currentTime <= endSec + 0.2) {
                    return;
                }
            }
        }

        // 2. Skip auto-selection if we are already at the exact timestamp of the active step
        if (activeStepId) {
            const currentActive = presentSteps.find(s => s.id === activeStepId);
            if (currentActive && Math.abs((currentActive.timestampMs / 1000) - currentTime) < 0.5) {
                return;
            }
        }

        const nearest = presentSteps.reduce<{ id: string; distance: number } | null>((best, step) => {
            const distance = Math.abs((step.timestampMs / 1000) - currentTime);
            if (!best || distance < best.distance) return { id: step.id, distance };
            return best;
        }, null);

        if (nearest && nearest.distance <= 1.0 && nearest.id !== activeStepId) {
            setActiveStepId(nearest.id);
            setSelectedStepIds(new Set([nearest.id]));
            setSelectedSubtitleSegmentId(null); // Clear subtitle if we auto-select a step
        }
    }, [currentTime, presentSteps, activeStepId, selectedSubtitleSegmentId, subtitleSegments]);

    const handleUpdateStep = useCallback((id: string, patch: Partial<ReviewTimelineStep>) => {
        setIsDraggingTimeline(true);
        setPresentSteps((current) => {
            const index = current.findIndex(s => s.id === id);
            if (index === -1) return current;
            const next = [...current];
            next[index] = { ...current[index], ...patch };
            return next;
        });
    }, []);

    const commitStepChanges = useCallback(() => {
        setIsDraggingTimeline(false);
        setPresentSteps(current => {
            const sorted = [...current].sort((a, b) => a.timestampMs - b.timestampMs);
            const ordered = sorted.map((s, i) => ({ ...s, order: i + 1 }));

            // Only push to history if there are changes compared to the last state in pastSteps
            const lastState = pastSteps[pastSteps.length - 1];
            if (JSON.stringify(lastState) !== JSON.stringify(ordered)) {
                setPastSteps(past => [...past, current]);
                setFutureSteps([]);
            }

            return ordered;
        });

        // Refocus active step after drag if needed
        if (activeStepId) {
            const step = presentSteps.find(s => s.id === activeStepId);
            if (step) {
                seekTo(step.timestampMs / 1000, { autoplay: false, stepId: activeStepId });
                setSelectedStepIds(new Set([activeStepId]));
            }
        }
    }, [pastSteps, activeStepId, presentSteps]);

    const handleReorderSteps = useCallback((newOrderSteps: any[]) => {
        setPresentSteps(current => {
            // Store history
            setPastSteps(past => [...past, current]);
            setFutureSteps([]);

            // To "alter the timeline", we swap the timestamps based on the new visual order
            // Get original timestamps in chronological order
            const originalTimestamps = [...current]
                .sort((a, b) => a.timestampMs - b.timestampMs)
                .map(s => s.timestampMs);

            // Re-map the steps with the new order but keeping the original timestamp sequence
            return newOrderSteps.map((s, i) => {
                const original = current.find(c => c.id === s.id);
                return {
                    ...original!,
                    order: i + 1,
                    timestampMs: originalTimestamps[i] || original!.timestampMs
                };
            });
        });
    }, []);

    const handleDeleteStep = useCallback((id: string) => {
        setPresentSteps((current) => {
            setPastSteps(past => [...past, current]);
            setFutureSteps([]);
            const filtered = current.filter(s => s.id !== id);
            return filtered.map((s, i) => ({ ...s, order: i + 1 }));
        });
        if (activeStepId === id) setActiveStepId(null);
    }, [activeStepId]);

    const handleSplitStep = useCallback(() => {
        if (!activeStepId) return;

        const stepToSplit = presentSteps.find(s => s.id === activeStepId);
        if (!stepToSplit) return;

        const currentMs = currentTime * 1000;
        const originalDuration = stepToSplit.durationMs ?? 8000;

        // Requirement: Playhead must be inside the selected step
        if (currentMs <= stepToSplit.timestampMs || currentMs >= stepToSplit.timestampMs + originalDuration) {
            return;
        }

        const firstPartDuration = currentMs - stepToSplit.timestampMs;
        const secondPartDuration = Math.max(500, originalDuration - firstPartDuration);

        // Update original and create new
        const updatedStep: ReviewTimelineStep = {
            ...stepToSplit,
            durationMs: firstPartDuration
        };

        const newStep: ReviewTimelineStep = {
            ...stepToSplit,
            id: `step-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            timestampMs: currentMs,
            durationMs: secondPartDuration,
            order: stepToSplit.order + 1
        };

        setPresentSteps(current => {
            setPastSteps(past => [...past, current]);
            setFutureSteps([]);
            const next = [...current];
            const index = next.findIndex(s => s.id === activeStepId);
            next[index] = updatedStep;
            next.push(newStep);
            const sorted = next.sort((a, b) => a.timestampMs - b.timestampMs);
            return sorted.map((s, i) => ({ ...s, order: i + 1 }));
        });

        toast.info(t('splitAt', { time: formatVideoTime(currentTime) }) || `Dividiendo en ${formatVideoTime(currentTime)}`);
        setActiveStepId(newStep.id);
        setSelectedStepIds(new Set([newStep.id]));
    }, [currentTime, presentSteps, t, activeStepId]);

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
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only trigger if not typing in an input/textarea
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if ((e.shiftKey) && !e.ctrlKey && !e.metaKey) {
                if (e.key === 'F') { e.preventDefault(); setZoom(100); setPanOffset({ x: 0, y: 0 }); }
                if (e.key === '0') { e.preventDefault(); setZoom(50); }
                if (e.key === '1') { e.preventDefault(); setZoom(100); }
                if (e.key === '2') { e.preventDefault(); setZoom(200); }
            }

            if (e.key === ' ' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
                e.preventDefault();
                togglePlayback();
            }

            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undo();
            }

            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                redo();
            }
        };

        window.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, [togglePlayback, undo, redo]);

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
            toast.success(t('changesSaved'));
        } catch {
            toast.error(t('changesSaveFailed'));
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
        <div className="flex flex-col h-full bg-background dark:bg-[#0f0f11] min-w-0 overflow-hidden">
            {/* Header / Info Bar */}
            <div className="bg-background-secondary/50 dark:bg-[#09090b] border-b border-border dark:border-[#2a2a2e] px-4 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <Link
                        href={`/projects/${projectId}/lumens`}
                        className="h-8 w-8 rounded-full hover:bg-background-secondary flex items-center justify-center text-foreground-muted hover:text-foreground transition-colors -ml-1"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Link>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <h1 className="text-sm font-bold text-foreground">{t('title')}</h1>
                        </div>
                        <p className="text-[11px] text-foreground-muted truncate max-w-md">
                            {session.intent || t('withoutIntent')}
                        </p>
                    </div>
                    {isRegenerating && (
                        <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 px-2 py-1 rounded">
                            <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
                            <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">{t('reprocessInProgress')}</span>
                        </div>
                    )}
                </div>

                {/* Header Toolbar (Zoom & Pan) */}
                <div className="flex items-center gap-1 bg-background-secondary dark:bg-[#141417] border border-border/60 dark:border-[#2a2a2e]/40 rounded-full px-1 py-1 shadow-sm">
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-7 w-7 rounded-full transition-colors", !isPanning ? "bg-background-secondary dark:bg-[#2a2a2e] text-foreground dark:text-white shadow-sm ring-1 ring-border/50 dark:ring-0" : "text-foreground-muted hover:text-foreground dark:text-white/50 dark:hover:text-white")}
                        onClick={() => setIsPanning(false)}
                    >
                        <MousePointer2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-7 w-7 rounded-full transition-colors", isPanning ? "bg-background text-foreground shadow-sm ring-1 ring-border/50 dark:ring-0" : "text-foreground-muted hover:text-foreground")}
                        onClick={() => setIsPanning(true)}
                    >
                        <Hand className="h-3.5 w-3.5" />
                    </Button>
                    <div className="w-[1px] h-3 bg-border/40 mx-0.5" />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 px-2 rounded-full text-[10px] font-bold gap-1 text-foreground/70 hover:text-foreground hover:bg-foreground/5 dark:text-white/70 dark:hover:text-white dark:hover:bg-white/5">
                                {zoom}%
                                <ChevronLeft className="h-2.5 w-2.5 rotate-[-90deg] opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" className="w-64 p-3 space-y-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-foreground-muted uppercase tracking-wider">{t('zoomSize')}</span>
                                    <span className="text-xs font-mono bg-background-secondary px-1.5 py-0.5 rounded">{zoom}%</span>
                                </div>
                                <Slider
                                    value={[zoom]}
                                    min={25}
                                    max={400}
                                    step={1}
                                    onValueChange={([v]) => setZoom(v)}
                                />
                            </div>
                            <DropdownMenuSeparator />
                            <div className="space-y-1">
                                <DropdownMenuItem onClick={() => { setZoom(100); setPanOffset({ x: 0, y: 0 }); }} className="text-xs font-medium justify-between cursor-pointer">
                                    {t('zoomToFit')}
                                    <span className="text-[10px] text-foreground-muted opacity-60">⇧ F</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setZoom(50)} className="text-xs font-medium justify-between cursor-pointer">
                                    {t('zoomTo50')}
                                    <span className="text-[10px] text-foreground-muted opacity-60">⇧ 0</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setZoom(75)} className="text-xs font-medium justify-between cursor-pointer">
                                    {t('zoomTo75')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setZoom(100)} className="text-xs font-medium justify-between cursor-pointer">
                                    {t('zoomTo100')}
                                    <span className="text-[10px] text-foreground-muted opacity-60">⇧ 1</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setZoom(200)} className="text-xs font-medium justify-between cursor-pointer">
                                    {t('zoomTo200')}
                                    <span className="text-[10px] text-foreground-muted opacity-60">⇧ 2</span>
                                </DropdownMenuItem>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-[11px] font-bold gap-1.5 text-foreground-muted hover:text-foreground hover:bg-background-secondary border-border dark:text-white/50 dark:hover:text-white dark:hover:bg-[#2a2a2e] dark:border-[#2a2a2e] transition-all shadow-sm px-3"
                        onClick={() => reprocessMutation.mutate({ observerSessionId: lumenId })}
                        disabled={reprocessMutation.isPending}
                    >
                        {reprocessMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Wand2 className="h-3.5 w-3.5 opacity-70" />
                        )}
                        {t('reprocess')}
                    </Button>
                    {canGenerate && (
                        <Button
                            size="sm"
                            className="h-8 text-[11px] bg-amber-500 hover:bg-amber-600 text-white border-none font-bold shadow-sm px-4"
                            onClick={() => {
                                generateMutation.mutate({ observerSessionId: lumenId }, {
                                    onSuccess: (data) => {
                                        toast.success(t('generateSuccess') || 'Walkthrough generated successfully');
                                        const walkthroughId = data?.createdWalkthroughs?.[0]?.walkthroughId;
                                        if (walkthroughId) {
                                            router.push(`/walkthroughs/${walkthroughId}`);
                                        } else {
                                            router.push(`/projects/${projectId}`);
                                        }
                                    },
                                    onError: () => {
                                        toast.error(t('generateFailed') || 'Failed to generate Walkthrough');
                                    }
                                });
                            }}
                            disabled={generateMutation.isPending}
                        >
                            {generateMutation.isPending ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                    {t('generatingWalkthrough') || 'Generating...'}
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                                    {t('generateWalkthrough') || 'Generate Walkthrough'}
                                </>
                            )}
                        </Button>
                    )}
                    <Button
                        size="sm"
                        className="h-8 text-[11px] bg-[#6366f1] hover:bg-[#6366f1]/90 text-white border-none font-bold shadow-sm px-4"
                        onClick={() => {
                            saveSubtitleSegments();
                            handleSaveSteps();
                        }}
                        disabled={saveTranscriptSegmentsMutation.isPending || saveReviewMutation.isPending}
                    >
                        {(saveTranscriptSegmentsMutation.isPending || saveReviewMutation.isPending) ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                {t('saving') || 'Saving...'}
                            </>
                        ) : (
                            <>
                                <Save className="h-3.5 w-3.5 mr-1.5" />
                                {t('save') || 'Save'}
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Main Editor Area with Resizable Panels */}
            <div className="flex-1 overflow-hidden">
                <ResizablePanelGroup direction="horizontal">
                    {/* Left Section: Properties Panel */}
                    <ResizablePanel
                        ref={propertiesPanelRef}
                        defaultSize={0}
                        minSize={25}
                        collapsible={true}
                        collapsedSize={0}
                        onCollapse={() => setIsPropertiesCollapsed(true)}
                        onExpand={() => setIsPropertiesCollapsed(false)}
                        className={cn(
                            "transition-all duration-300 ease-in-out",
                            isPropertiesCollapsed ? "min-w-[0px]" : ""
                        )}
                    >
                        <div className="h-full bg-background dark:bg-[#111114] border-r border-border dark:border-[#2d2d30] overflow-hidden flex flex-col z-10 relative shadow-xl">
                            <div className="p-4 border-b border-border dark:border-[#2d2d30] bg-background-secondary/50 dark:bg-[#09090b] shrink-0 flex items-center justify-between">
                                <h2 className="text-sm font-bold text-foreground dark:text-white">{t('properties')}</h2>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7 text-foreground/40 hover:text-foreground hover:bg-secondary/50 rounded-full"
                                    onClick={() => {
                                        setActiveStepId(null);
                                        setSelectedSubtitleSegmentId(null);
                                        setSelectedStepIds(new Set());
                                        propertiesPanelRef.current?.collapse();
                                    }}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                                <div className="px-4 pt-4 shrink-0">
                                    <TabsList className="grid w-full grid-cols-2 h-9">
                                        <TabsTrigger value="steps" className="text-xs font-semibold">{t('steps') || 'Pasos'}</TabsTrigger>
                                        <TabsTrigger value="subtitles" className="text-xs font-semibold">{t('transcriptSegments') || 'Subtítulos'}</TabsTrigger>
                                    </TabsList>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4">
                                    <TabsContent value="steps" className="mt-0 space-y-4 focus-visible:outline-none focus-visible:ring-0">
                                        {activeStepId ? (() => {
                                            const step = presentSteps.find(s => s.id === activeStepId);
                                            if (!step) return null;
                                            return (
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-sm font-semibold text-foreground dark:text-white">{t('selectedStep')}</div>
                                                    </div>
                                                    
                                                    <div className="space-y-2">
                                                        <Label className="text-xs text-foreground-muted dark:text-white/50">{t('stepTitle') || 'Título'}</Label>
                                                        <Input 
                                                            value={step.title}
                                                            onChange={(e) => handleUpdateStep(activeStepId, { title: e.target.value })}
                                                            placeholder={t('stepTitle') || 'Título del paso'}
                                                            className="h-8 text-sm"
                                                        />
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-2">
                                                            <Label className="text-xs text-foreground-muted dark:text-white/50">{t('startTime')} ({t('milliseconds')})</Label>
                                                            <Input 
                                                                type="number"
                                                                value={step.timestampMs}
                                                                onChange={(e) => handleUpdateStep(activeStepId, { timestampMs: parseInt(e.target.value) || 0 })}
                                                                className="h-8 text-sm font-mono"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs text-foreground-muted dark:text-white/50">{t('duration')} ({t('milliseconds')})</Label>
                                                            <Input 
                                                                type="number"
                                                                value={step.durationMs || 8000}
                                                                onChange={(e) => handleUpdateStep(activeStepId, { durationMs: parseInt(e.target.value) || 0 })}
                                                                className="h-8 text-sm font-mono"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label className="text-xs text-foreground-muted dark:text-white/50">{t('stepDescription') || 'Descripción'}</Label>
                                                        <Textarea 
                                                            value={step.description}
                                                            onChange={(e) => handleUpdateStep(activeStepId, { description: e.target.value })}
                                                            placeholder={t('stepDescription') || 'Descripción del paso'}
                                                            className="resize-none h-32 text-sm"
                                                        />
                                                    </div>

                                                    <div className="pt-4 mt-4 border-t border-border flex items-center gap-2">
                                                        <Button 
                                                            size="sm" 
                                                            className="w-full text-xs bg-accent-blue hover:bg-accent-blue/90 text-white h-8 gap-2"
                                                            onClick={() => {
                                                                handleSaveSteps();
                                                                saveSubtitleSegments();
                                                            }}
                                                            disabled={saveReviewMutation.isPending || saveTranscriptSegmentsMutation.isPending}
                                                        >
                                                            {saveReviewMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                                            {t('save')}
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })() : (
                                            <div className="h-40 flex items-center justify-center text-center">
                                                <p className="text-xs text-foreground-muted italic">
                                                    {t('selectStepInTimeline')}
                                                </p>
                                            </div>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="subtitles" className="mt-0 space-y-4 focus-visible:outline-none focus-visible:ring-0">
                                        {selectedSubtitleSegmentId ? (() => {
                                            const subtitle = subtitleSegments.find(s => s.id === selectedSubtitleSegmentId);
                                            if (!subtitle) return null;
                                            return (
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-sm font-semibold text-foreground">{t('selectedSubtitle')}</div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-2">
                                                            <Label className="text-xs text-foreground/70">{t('startTime')} ({t('milliseconds')})</Label>
                                                            <Input 
                                                                type="number"
                                                                value={subtitle.startMs}
                                                                onChange={(e) => updateSubtitleSegment(selectedSubtitleSegmentId, { startMs: parseInt(e.target.value) || 0 })}
                                                                className="h-8 text-sm font-mono"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs text-foreground/70">{t('endTime')} ({t('milliseconds')})</Label>
                                                            <Input 
                                                                type="number"
                                                                value={subtitle.endMs}
                                                                onChange={(e) => updateSubtitleSegment(selectedSubtitleSegmentId, { endMs: parseInt(e.target.value) || 0 })}
                                                                className="h-8 text-sm font-mono"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label className="text-xs text-foreground/70">{t('subtitleText') || 'Texto'}</Label>
                                                        <Textarea 
                                                            value={subtitle.text}
                                                            onChange={(e) => updateSubtitleSegment(selectedSubtitleSegmentId, { text: e.target.value })}
                                                            placeholder={t('subtitleText') || 'Texto del subtítulo'}
                                                            className="resize-none h-32 text-sm leading-relaxed"
                                                        />
                                                    </div>

                                                    <div className="pt-4 mt-4 border-t border-border flex items-center gap-2">
                                                        <Button 
                                                            size="sm" 
                                                            className="w-full text-xs bg-accent-blue hover:bg-accent-blue/90 text-white h-8 gap-2"
                                                            onClick={() => {
                                                                handleSaveSteps();
                                                                saveSubtitleSegments();
                                                            }}
                                                            disabled={saveReviewMutation.isPending || saveTranscriptSegmentsMutation.isPending}
                                                        >
                                                            {saveReviewMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                                            {t('save')}
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })() : (
                                            <div className="h-40 flex items-center justify-center text-center">
                                                <p className="text-xs text-foreground-muted italic">
                                                    {t('selectSubtitleInTimeline')}
                                                </p>
                                            </div>
                                        )}
                                    </TabsContent>
                                </div>
                            </Tabs>
                        </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle={false} className="relative z-[100] w-px bg-border dark:bg-[#2d2d30] after:hidden">
                        <div
                            className="absolute top-1/2 -translate-y-1/2 left-0 flex h-12 w-3.0 cursor-pointer items-center justify-center rounded-r-full bg-background-secondary dark:bg-[#111114] border border-l-0 border-border dark:border-[#2d2d30] shadow-[2px_0_8px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_8px_rgba(0,0,0,0.3)] text-foreground-muted hover:text-foreground dark:text-white/40 dark:hover:text-white hover:bg-background-secondary/80 dark:hover:bg-[#1a1a1e] transition-colors"
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
                                <ChevronRight className="h-3 w-3 opacity-80 -ml-0.5" />
                            ) : (
                                <ChevronLeft className="h-3 w-3 opacity-80 -ml-0.5" />
                            )}
                        </div>
                    </ResizableHandle>

                    {/* Right Section: Video and Timeline */}
                    <ResizablePanel defaultSize={75}>
                        <ResizablePanelGroup direction="vertical">
                            {/* Top Section: Stage */}
                            <ResizablePanel defaultSize={75} minSize={30}>
                                <div
                                    ref={canvasRef}
                                    className={cn(
                                        "h-full w-full bg-background-secondary/30 dark:bg-[#18181c] flex items-center justify-center relative overflow-hidden",
                                        isPanning ? "cursor-grab active:cursor-grabbing" : "cursor-default"
                                    )}
                                    onMouseDown={handleMouseDown}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUp}
                                    onMouseLeave={handleMouseUp}
                                >
                                    {/* Subtle ambient light for studio feel */}
                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.03)_0%,_transparent_80%)] pointer-events-none opacity-40" />

                                    {/* Video Stage - Scaling and Panning applied here */}
                                    <div
                                        className="w-[90%] max-w-6xl aspect-video bg-black shadow-[0_30px_60px_rgba(0,0,0,0.3)] border border-white/5 z-10 transition-transform duration-200 ease-out will-change-transform"
                                        style={{
                                            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom / 100})`,
                                        }}
                                    >
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
                                                hideControls={true}
                                                volume={volume}
                                                lastVolume={lastVolume}
                                                onVolumeChange={handleVolumeChange}
                                                renderTimeline={() => null}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-foreground/20">
                                                <Play className="h-16 w-16 opacity-5" />
                                                <p className="text-sm font-medium uppercase tracking-widest">{t('noVideoAvailable')}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </ResizablePanel>

                            <ResizableHandle />

                            {/* Bottom Section: Full Width Timeline */}
                            <ResizablePanel defaultSize={35} minSize={20}>
                                <div className="h-full bg-background dark:bg-[#0f0f11] shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_30px_rgba(0,0,0,0.2)] z-50 overflow-hidden">
                                    <CapcutTimeline
                                        durationSec={durationSec}
                                        currentTimeSec={currentTime}
                                        segments={subtitleSegments}
                                        steps={presentSteps
                                            .filter((s, i, arr) => arr.findIndex(t => t.id === s.id) === i)
                                            .map(s => ({
                                                id: s.id,
                                                order: s.order,
                                                startMs: s.timestampMs,
                                                endMs: Math.min((durationSec || 10) * 1000, s.timestampMs + (s.durationMs ?? 8000)),
                                                text: s.title,
                                                description: s.description
                                            }))}
                                        selectedSegmentId={selectedSubtitleSegmentId || activeStepId}
                                        selectedStepIds={selectedStepIds}
                                        onSeek={(sec) => seekTo(sec, { autoplay: false })}
                                        onUpdateSegment={updateSubtitleSegment}
                                        onSelectSegment={(id) => {
                                            lastManualSelectionTime.current = Date.now();
                                            const segment = subtitleSegments.find(s => s.id === id);
                                            if (segment) {
                                                seekTo(segment.startMs / 1000, { autoplay: false });
                                            }
                                            setSelectedSubtitleSegmentId(id);
                                            setActiveStepId(null);
                                            setSelectedStepIds(new Set());
                                            setActiveTab('subtitles');
                                            propertiesPanelRef.current?.expand(); // Only expand on timeline click
                                        }}
                                        onSelectStep={(id, multi, fromTimeline) => {
                                            lastManualSelectionTime.current = Date.now();
                                            
                                            // 1. Force immediate UI state change
                                            setActiveTab('steps');
                                            setActiveStepId(id);
                                            setSelectedSubtitleSegmentId(null);
                                            
                                            // 2. Expand panel BEFORE other logic
                                            if (fromTimeline) {
                                                propertiesPanelRef.current?.expand();
                                            }

                                            // 3. Update Selection Set
                                            if (multi) {
                                                setSelectedStepIds(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(id)) next.delete(id);
                                                    else next.add(id);
                                                    return next;
                                                });
                                            } else {
                                                setSelectedStepIds(new Set([id]));
                                            }

                                            // 4. Conditional Seek
                                            const step = presentSteps.find(s => s.id === id);
                                            if (step) {
                                                const targetSec = step.timestampMs / 1000;
                                                if (Math.abs(currentTime - targetSec) > 0.1) {
                                                    seekTo(targetSec, { autoplay: false, stepId: id });
                                                }
                                            }
                                        }}
                                        onUpdateStep={(id, patch) => {
                                            setPresentSteps(prev => {
                                                const next = prev.map(s => s.id === id ? { 
                                                    ...s, 
                                                    timestampMs: patch.startMs ?? s.timestampMs,
                                                    durationMs: patch.endMs ? patch.endMs - (patch.startMs ?? s.timestampMs) : s.durationMs
                                                } : s);
                                                
                                                // Auto-sort steps by timestamp when updated from timeline
                                                return [...next].sort((a, b) => a.timestampMs - b.timestampMs);
                                            });
                                        }}
                                        onDeleteStep={handleDeleteStep}
                                        onSplitStep={handleSplitStep}
                                        onMergeSteps={async () => {
                                            if (selectedStepIds.size < 2) return;

                                            const stepIds = Array.from(selectedStepIds);
                                            const sortedIds = presentSteps
                                                .filter(s => selectedStepIds.has(s.id))
                                                .map(s => s.id);

                                            const loadingToast = toast.loading('Merging steps with AI...');
                                            const idsToMerge = [...sortedIds];
                                            setSelectedStepIds(new Set());
                                            try {
                                                const result = await mergeStepsMutation.mutateAsync({
                                                    observerSessionId: lumenId,
                                                    stepIds: idsToMerge
                                                });

                                                setPastSteps(prev => [...prev, presentSteps]);
                                                setFutureSteps([]);

                                                setPresentSteps(prev => {
                                                    const filtered = prev.filter(s => !idsToMerge.includes(s.id));
                                                    const firstIndex = prev.findIndex(s => s.id === idsToMerge[0]);
                                                    const next = [...filtered];
                                                    next.splice(firstIndex, 0, result);
                                                    return next.map((s, i) => ({ ...s, order: i + 1 }));
                                                });

                                                setActiveStepId(result.id);
                                                toast.success('Steps merged and refined successfully', { id: loadingToast });
                                            } catch (error) {
                                                toast.error('Failed to merge steps', { id: loadingToast });
                                            }
                                        }}
                                        selectedStepIds={selectedStepIds}
                                        onUndo={undo}
                                        onRedo={redo}
                                        canUndo={pastSteps.length > 0}
                                        canRedo={futureSteps.length > 0}
                                        videoRef={videoRef}
                                        isPlaying={isPlaying}
                                        onTogglePlayback={togglePlayback}
                                        playbackRate={playbackRate}
                                        onPlaybackRateChange={setPlaybackRate}
                                        showSubtitles={showSubtitles}
                                        onToggleSubtitles={() => setShowSubtitles(!showSubtitles)}
                                        volume={volume}
                                        lastVolume={lastVolume}
                                        onVolumeChange={handleVolumeChange}
                                        onDragEnd={commitStepChanges}
                                        onReorderSteps={handleReorderSteps}
                                        t={t}
                                    />
                                </div>
                            </ResizablePanel>
                        </ResizablePanelGroup>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </div>
    );
}
