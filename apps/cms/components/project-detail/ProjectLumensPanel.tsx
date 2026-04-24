'use client';

import Link from 'next/link';
import { useGenerateWalkthroughsFromLumen, useLumens } from '@luma/infra';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { MainContent } from '@/components/shared/MainContent';

interface ProjectLumensPanelProps {
    projectId: string;
}

export function ProjectLumensPanel({ projectId }: ProjectLumensPanelProps) {
    const t = useTranslations('ProjectLumens');
    const { data, isLoading } = useLumens(projectId, 50);
    const generateMutation = useGenerateWalkthroughsFromLumen();
    const lumens = Array.isArray(data) ? data : (data?.data || []);

    return (
        <MainContent>
            <div className="space-y-4">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">{t('title')}</h2>
                    <p className="text-sm text-foreground-muted mt-1">{t('description')}</p>
                </div>

                <div className="rounded-lg border border-border bg-background">
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">{t('recentLumens')}</p>
                        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-foreground-muted" />}
                    </div>
                    <div className="divide-y divide-border">
                        {!isLoading && lumens.length === 0 && (
                            <p className="px-4 py-4 text-sm text-foreground-muted">{t('empty')}</p>
                        )}
                        {lumens.map((lumen: any) => (
                            <div key={lumen.id} className="px-4 py-3 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">
                                        {lumen.intent || t('withoutIntent')}
                                    </p>
                                    <p className="text-xs text-foreground-muted mt-1">
                                        {new Date(lumen.startedAt).toLocaleString()} · {t(`status.${lumen.status}`)}
                                        {' · '}
                                        {t('source')}: {t(`captureSource.${lumen.captureSource || 'unknown'}`)}
                                        {' · '}
                                        {typeof lumen.videoDurationMs === 'number'
                                            ? `${Math.round(lumen.videoDurationMs / 1000)}s`
                                            : '—'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Link href={`/projects/${projectId}/lumens/${lumen.id}`}>
                                        <Button size="sm" variant="outline" className="h-8">
                                            {t('review')}
                                        </Button>
                                    </Link>
                                    {lumen.status === 'ready_for_review' && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8"
                                            disabled={generateMutation.isPending}
                                            onClick={async () => {
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
