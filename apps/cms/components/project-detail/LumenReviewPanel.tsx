'use client';

import { useState, useMemo, useEffect, useRef, useReducer, useCallback } from 'react';
import { 
    Play, 
    Pause, 
    RotateCcw, 
    Save, 
    Check, 
    Wand2, 
    Plus, 
    Trash2, 
    ChevronRight, 
    ChevronLeft,
    Undo2,
    Redo2,
    Clock,
    Type,
    FileText,
    Settings,
    Split
} from 'lucide-react';
import { 
    useLumenReview, 
    useGenerateWalkthroughsFromLumen, 
    useReprocessLumen,
    useSaveLumenReview,
    useImproveSubtitle
} from '@luma/infra';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { CapcutTimeline } from './CapcutTimeline';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface VideoTextSegment {
    id: string;
    order: number;
    startMs: number;
    endMs: number;
    text: string;
    title?: string;
    description?: string;
    metadata?: Record<string, any>;
}

interface HistoryState {
    history: VideoTextSegment[][];
    pointer: number;
    current: VideoTextSegment[];
}

type HistoryAction = 
    | { type: 'SET'; payload: VideoTextSegment[] | ((prev: VideoTextSegment[]) => VideoTextSegment[]) }
    | { type: 'SET_DRAFT'; payload: VideoTextSegment[] | ((prev: VideoTextSegment[]) => VideoTextSegment[]) }
    | { type: 'COMMIT' }
    | { type: 'UNDO' }
    | { type: 'REDO' }
    | { type: 'RESET'; payload: VideoTextSegment[] };

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
    switch (action.type) {
        case 'SET': {
            const nextCurrent = typeof action.payload === 'function' ? action.payload(state.current) : action.payload;
            if (JSON.stringify(state.current) === JSON.stringify(nextCurrent)) return state;
            const newHistory = state.history.slice(0, state.pointer + 1);
            newHistory.push(nextCurrent);
            if (newHistory.length > 50) newHistory.shift();
            return {
                history: newHistory,
                pointer: newHistory.length - 1,
                current: nextCurrent
            };
        }
        case 'SET_DRAFT': {
            const nextCurrent = typeof action.payload === 'function' ? action.payload(state.current) : action.payload;
            return {
                ...state,
                current: nextCurrent
            };
        }
        case 'COMMIT': {
            const newHistory = state.history.slice(0, state.pointer + 1);
            newHistory.push(state.current);
            if (newHistory.length > 50) newHistory.shift();
            return {
                history: newHistory,
                pointer: newHistory.length - 1,
                current: state.current
            };
        }
        case 'UNDO': {
            if (state.pointer > 0) {
                return {
                    ...state,
                    pointer: state.pointer - 1,
                    current: state.history[state.pointer - 1] as VideoTextSegment[]
                };
            }
            return state;
        }
        case 'REDO': {
            if (state.pointer < state.history.length - 1) {
                return {
                    ...state,
                    pointer: state.pointer + 1,
                    current: state.history[state.pointer + 1] as VideoTextSegment[]
                };
            }
            return state;
        }
        case 'RESET': {
            return {
                history: [action.payload],
                pointer: 0,
                current: action.payload
            };
        }
        default:
            return state;
    }
}

export function LumenReviewPanel({ projectId, lumenId }: { projectId: string, lumenId: string }) {
    const { data, isLoading, isError, refetch } = useLumenReview(lumenId);
    const saveReviewMutation = useSaveLumenReview();
    const generateMutation = useGenerateWalkthroughsFromLumen();
    const reprocessMutation = useReprocessLumen();
    const improveSubtitleMutation = useImproveSubtitle();

    const videoRef = useRef<HTMLVideoElement>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    
    const [activeTab, setActiveTab] = useState<'subtitles' | 'steps'>('subtitles');

    // Subtitles State
    const [historyState, dispatchHistory] = useReducer(historyReducer, {
        history: [[]],
        pointer: 0,
        current: []
    });
    const [selectedSubtitleId, setSelectedSubtitleId] = useState<string | null>(null);

    // Steps State
    const [stepsHistory, dispatchStepsHistory] = useReducer(historyReducer, {
        history: [[]],
        pointer: 0,
        current: []
    });
    const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

    // Sync state with data when loaded
    const lastSessionId = useRef<string | null>(null);
    useEffect(() => {
        if (data && data.session.id !== lastSessionId.current) {
            lastSessionId.current = data.session.id;
            
            // Extract Subtitles
            const subs: VideoTextSegment[] = (data.session.processingSummary?.subtitleSegments || []).map((s: any, i: number) => ({
                id: s.id || `sub-${i}`,
                order: s.order || i,
                startMs: s.startMs,
                endMs: s.endMs,
                text: s.text,
            }));
            dispatchHistory({ type: 'RESET', payload: subs });

            // Extract Steps
            const steps: VideoTextSegment[] = (data.stepCandidates || []).map((s: any, i: number) => ({
                id: s.id || `step-${i}`,
                order: s.order || i,
                startMs: s.timestampMs,
                endMs: s.timestampMs + 3000,
                title: s.title,
                description: s.description,
                text: s.description,
            }));
            dispatchStepsHistory({ type: 'RESET', payload: steps });
        }
    }, [data]);

    const durationSec = data?.session?.videoDurationMs ? data.session.videoDurationMs / 1000 : 0;

    const togglePlayback = useCallback(() => {
        if (!videoRef.current) return;
        if (videoRef.current.paused) {
            videoRef.current.play().catch(() => undefined);
        } else {
            videoRef.current.pause();
        }
    }, []);

    const handleSeek = (sec: number) => {
        if (videoRef.current) {
            videoRef.current.currentTime = sec;
        }
    };

    const handleUpdateSubtitle = (id: string, patch: Partial<VideoTextSegment>) => {
        dispatchHistory({
            type: 'SET_DRAFT',
            payload: (prev) => prev.map(s => s.id === id ? { ...s, ...patch } : s)
        });
    };

    const handleUpdateStep = (id: string, patch: Partial<VideoTextSegment>) => {
        dispatchStepsHistory({
            type: 'SET_DRAFT',
            payload: (prev) => prev.map(s => s.id === id ? { ...s, ...patch } : s)
        });
    };

    const handleUpdateEnd = (type: 'subtitle' | 'step') => {
        if (type === 'subtitle') dispatchHistory({ type: 'COMMIT' });
        else dispatchStepsHistory({ type: 'COMMIT' });
    };

    const handleSave = async () => {
        try {
            await saveReviewMutation.mutateAsync({
                observerSessionId: lumenId,
                subtitleSegments: historyState.current,
                stepCandidates: stepsHistory.current.map(s => ({
                    id: s.id,
                    order: s.order,
                    timestampMs: s.startMs,
                    title: s.title,
                    description: s.description,
                }))
            });
            toast.success('Cambios guardados correctamente');
        } catch (error) {
            toast.error('Error al guardar los cambios');
        }
    };

    const handleImproveSubtitle = async (id: string, currentText: string) => {
        try {
            const result = await improveSubtitleMutation.mutateAsync({
                observerSessionId: lumenId,
                segmentId: id,
                text: currentText
            });
            handleUpdateSubtitle(id, { text: result.text });
            dispatchHistory({ type: 'COMMIT' });
            toast.success('Subtítulo mejorado con IA');
        } catch (error) {
            toast.error('Error al mejorar el subtítulo');
        }
    };

    if (isLoading) return <div className="p-8"><Skeleton className="h-full w-full" /></div>;
    if (isError) return <div className="p-8 text-red-500">Error al cargar la sesión</div>;

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden">
            {/* Top Bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold tracking-tight">Reviewing Session</h1>
                    <div className={cn(
                        "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        data?.session.status === 'ready_for_review' ? "bg-green-500/10 text-green-500" : "bg-amber-500/10 text-amber-500"
                    )}>
                        {data?.session.status.replace(/_/g, ' ')}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => dispatchHistory({ type: 'UNDO' })}
                        disabled={historyState.pointer === 0}
                    >
                        <Undo2 className="w-4 h-4 mr-2" /> Undo
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => dispatchHistory({ type: 'REDO' })}
                        disabled={historyState.pointer === historyState.history.length - 1}
                    >
                        <Redo2 className="w-4 h-4 mr-2" /> Redo
                    </Button>
                    <Button 
                        variant="default" 
                        size="sm" 
                        onClick={handleSave}
                        disabled={saveReviewMutation.isPending}
                    >
                        {saveReviewMutation.isPending ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Video Player Section */}
                    <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
                        <video
                            ref={videoRef}
                            src={data?.videoUrl || undefined}
                            className="max-h-full max-w-full"
                            onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                            onLoadedMetadata={() => setCurrentTime(0)}
                        />
                        
                        {/* Subtitle Overlay */}
                        <div className="absolute bottom-12 left-0 right-0 flex justify-center pointer-events-none">
                            <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-lg text-white text-lg font-medium max-w-[80%] text-center border border-white/10">
                                {historyState.current.find(s => (currentTime * 1000) >= s.startMs && (currentTime * 1000) <= s.endMs)?.text || ""}
                            </div>
                        </div>

                        {/* Player Controls Overlay */}
                        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent flex items-center px-6 gap-4">
                            <button onClick={togglePlayback} className="text-white hover:text-red-500 transition-colors">
                                {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
                            </button>
                            <div className="text-white/70 font-mono text-sm">
                                {formatVideoTime(currentTime)} / {formatVideoTime(durationSec)}
                            </div>
                        </div>
                    </div>

                    {/* Timeline Section */}
                    <div className="h-[350px] bg-slate-950 border-t border-white/5">
                        <CapcutTimeline 
                            durationSec={durationSec}
                            currentTimeSec={currentTime}
                            subtitleSegments={historyState.current}
                            selectedSubtitleId={selectedSubtitleId}
                            stepSegments={stepsHistory.current}
                            selectedStepId={selectedStepId}
                            onSeek={handleSeek}
                            onUpdateSubtitle={handleUpdateSubtitle}
                            onUpdateStep={handleUpdateStep}
                            onUpdateEnd={handleUpdateEnd}
                            onSelectSubtitle={setSelectedSubtitleId}
                            onSelectStep={setSelectedStepId}
                            videoRef={videoRef}
                        />
                    </div>
                </div>

                {/* Sidebar Section */}
                <div className="w-[400px] border-l flex flex-col bg-background/50 backdrop-blur-xl">
                    <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="flex-1 flex flex-col">
                        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-12 px-4 gap-4">
                            <TabsTrigger value="subtitles" className="data-[state=active]:bg-white/5 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full">Subtitles</TabsTrigger>
                            <TabsTrigger value="steps" className="data-[state=active]:bg-white/5 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full">Steps</TabsTrigger>
                        </TabsList>
                        
                        <div className="flex-1 overflow-y-auto">
                            <div className="p-6">
                                <TabsContent value="subtitles" className="m-0 space-y-6">
                                    {historyState.current.map((seg) => (
                                        <div 
                                            key={seg.id}
                                            className={cn(
                                                "p-4 rounded-xl border transition-all cursor-pointer group",
                                                selectedSubtitleId === seg.id ? "bg-white/5 border-primary shadow-lg ring-1 ring-primary/20" : "border-border/50 hover:border-border"
                                            )}
                                            onClick={() => {
                                                setSelectedSubtitleId(seg.id);
                                                handleSeek(seg.startMs / 1000);
                                            }}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="text-[10px] font-mono font-bold text-muted-foreground flex items-center gap-1.5">
                                                    <Clock className="w-3 h-3" />
                                                    {formatVideoTime(seg.startMs / 1000)} - {formatVideoTime(seg.endMs / 1000)}
                                                </div>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleImproveSubtitle(seg.id, seg.text);
                                                    }}
                                                    disabled={improveSubtitleMutation.isPending}
                                                >
                                                    <Wand2 className="w-3.5 h-3.5 text-primary" />
                                                </Button>
                                            </div>
                                            <Textarea 
                                                value={seg.text}
                                                onChange={(e) => handleUpdateSubtitle(seg.id, { text: e.target.value })}
                                                className="bg-transparent border-none p-0 focus-visible:ring-0 resize-none min-h-[40px] text-sm leading-relaxed"
                                                onBlur={() => dispatchHistory({ type: 'COMMIT' })}
                                            />
                                        </div>
                                    ))}
                                </TabsContent>

                                <TabsContent value="steps" className="m-0 space-y-6">
                                    {stepsHistory.current.map((step) => (
                                        <div 
                                            key={step.id}
                                            className={cn(
                                                "p-4 rounded-xl border transition-all cursor-pointer",
                                                selectedStepId === step.id ? "bg-amber-500/5 border-amber-500 shadow-lg ring-1 ring-amber-500/20" : "border-border/50 hover:border-border"
                                            )}
                                            onClick={() => {
                                                setSelectedStepId(step.id);
                                                handleSeek(step.startMs / 1000);
                                            }}
                                        >
                                            <div className="text-[10px] font-mono font-bold text-amber-500/70 mb-2 flex items-center gap-1.5">
                                                <Clock className="w-3 h-3" />
                                                {formatVideoTime(step.startMs / 1000)}
                                            </div>
                                            <Input 
                                                value={step.title || ""}
                                                onChange={(e) => handleUpdateStep(step.id, { title: e.target.value })}
                                                placeholder="Step Title"
                                                className="bg-transparent border-none p-0 focus-visible:ring-0 font-bold mb-1 h-7"
                                                onBlur={() => dispatchStepsHistory({ type: 'COMMIT' })}
                                            />
                                            <Textarea 
                                                value={step.description || ""}
                                                onChange={(e) => handleUpdateStep(step.id, { description: e.target.value })}
                                                placeholder="Step Description"
                                                className="bg-transparent border-none p-0 focus-visible:ring-0 resize-none min-h-[40px] text-xs text-muted-foreground leading-relaxed"
                                                onBlur={() => dispatchStepsHistory({ type: 'COMMIT' })}
                                            />
                                        </div>
                                    ))}
                                </TabsContent>
                            </div>
                    </div>
                    </Tabs>
                </div>
            </div>

            <style jsx>{`
                .scrollbar-none::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
        </div>
    );
}

function formatVideoTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${ms}`;
}
