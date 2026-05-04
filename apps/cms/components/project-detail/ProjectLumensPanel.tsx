'use client';

import Link from 'next/link';
import { useGenerateWalkthroughsFromLumen, useLumens } from '@luma/infra';
import { Button } from '@/components/ui/button';
import { Loader2, Play, Video, FileVideo, Globe, Monitor, Clock, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { MainContent } from '@/components/shared/MainContent';
import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';

interface ProjectLumensPanelProps {
    projectId: string;
}

export function ProjectLumensPanel({ projectId }: ProjectLumensPanelProps) {
    const t = useTranslations('ProjectLumens');
    const { data, isLoading } = useLumens(projectId, 50);
    const generateMutation = useGenerateWalkthroughsFromLumen();
    const lumens = Array.isArray(data) ? data : (data?.data || []);

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'ready_for_review':
                return 'bg-green-500/10 text-green-600 border-green-500/20';
            case 'recording':
                return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
            case 'processing':
                return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
            default:
                return 'bg-foreground-muted/10 text-foreground-muted border-foreground-muted/20';
        }
    };

    const getSourceIcon = (source: string) => {
        switch (source?.toLowerCase()) {
            case 'dom':
                return <Globe className="h-3 w-3" />;
            case 'webmcp':
                return <Monitor className="h-3 w-3" />;
            default:
                return <Video className="h-3 w-3" />;
        }
    };

    return (
        <MainContent fill className="bg-background-secondary/30">
            <div className="flex flex-col h-full space-y-6">
                <div className="rounded-xl border border-border/50 bg-background shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
                    <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between bg-background-secondary/10 shrink-0">
                        <div className="flex items-center gap-2">
                            <PlayCircle className="h-4 w-4 text-accent-blue" />
                            <p className="text-sm font-bold text-foreground tracking-tight">{t('recentLumens')}</p>
                        </div>
                        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-accent-blue" />}
                    </div>
                    
                    <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-border/40">
                        {!isLoading && lumens.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                                <div className="h-12 w-12 rounded-full bg-background-secondary flex items-center justify-center mb-3">
                                    <Video className="h-6 w-6 text-foreground-muted/40" />
                                </div>
                                <p className="text-sm font-medium text-foreground">{t('empty')}</p>
                            </div>
                        )}
                        
                        {lumens.map((lumen: any) => (
                            <div 
                                key={lumen.id} 
                                className="group px-6 py-4 flex items-start gap-5 hover:bg-background-secondary/30 transition-colors"
                            >
                                <Link 
                                    href={`/projects/${projectId}/lumens/${lumen.id}`}
                                    className="flex items-start gap-5 flex-1 min-w-0"
                                >
                                    {/* Stylized Thumbnail Placeholder */}
                                    <div className="h-16 w-24 rounded-lg bg-background-secondary border border-border/50 flex items-center justify-center shrink-0 overflow-hidden relative group-hover:border-accent-blue/30 transition-colors shadow-sm">
                                        <FileVideo className="h-6 w-6 text-foreground-muted/30 group-hover:text-accent-blue/40 transition-colors" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent" />
                                        {lumen.videoDurationMs && (
                                            <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-[9px] font-bold text-white px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">
                                                <Clock className="h-2.5 w-2.5" />
                                                {Math.round(lumen.videoDurationMs / 1000)}s
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0 py-0.5">
                                        <div className="flex items-center gap-3 mb-1.5">
                                            <p className="text-sm font-bold text-foreground group-hover:text-accent-blue transition-colors truncate">
                                                {lumen.intent || t('withoutIntent')}
                                            </p>
                                            <Badge 
                                                variant="outline" 
                                                className={cn("px-1.5 py-0 text-[10px] font-bold uppercase tracking-wider", getStatusStyles(lumen.status))}
                                            >
                                                {t(`status.${lumen.status}`)}
                                            </Badge>
                                        </div>
                                        
                                        <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-[11px] text-foreground-muted font-medium">
                                            <span className="flex items-center gap-1.5 whitespace-nowrap">
                                                <Clock className="h-3 w-3 opacity-60" />
                                                {new Date(lumen.startedAt).toLocaleString(undefined, {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </span>
                                            <span className="flex items-center gap-1.5 whitespace-nowrap">
                                                {getSourceIcon(lumen.captureSource)}
                                                {t('source')}: {t(`captureSource.${lumen.captureSource || 'unknown'}`)}
                                            </span>
                                        </div>
                                    </div>
                                </Link>

                                <div className="flex items-center gap-2 shrink-0 self-center">
                                    <Link href={`/projects/${projectId}/lumens/${lumen.id}`}>
                                        <Button size="sm" variant="outline" className="h-8 text-xs font-semibold hover:bg-background border-border/60">
                                            {t('review')}
                                        </Button>
                                    </Link>
                                    {lumen.status === 'ready_for_review' && (
                                        <Button
                                            size="sm"
                                            className="h-8 text-xs font-bold bg-accent-blue hover:bg-accent-blue/90 text-white shadow-sm"
                                            disabled={generateMutation.isPending}
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                try {
                                                    const res = await generateMutation.mutateAsync({
                                                        observerSessionId: lumen.id,
                                                        mode: 'single',
                                                    });
                                                    toast.success(t('generated', { count: res.createdWalkthroughs.length }));
                                                } catch {
                                                    toast.error(t('generateFailed'));
                                                }
                                            }}
                                        >
                                            <Play className="h-3 w-3 mr-1.5 fill-current" />
                                            {t('generate')}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </MainContent>
    );
}
