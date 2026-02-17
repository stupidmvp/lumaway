'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useWalkthroughVersions, useRestoreVersion, WalkthroughVersion } from '@luma/infra';
import { X, Clock, AlertTriangle, Check, RotateCcw, History, Loader2 } from 'lucide-react';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';

interface VersionHistoryDrawerProps {
    walkthroughId: string;
    onClose: () => void;
}

export default function VersionHistoryDrawer({ walkthroughId, onClose }: VersionHistoryDrawerProps) {
    const {
        data,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useWalkthroughVersions(walkthroughId);
    const restoreMutation = useRestoreVersion();
    const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const t = useTranslations('VersionHistory');
    const tc = useTranslations('Common');
    const locale = useLocale();

    // Flatten pages into a single list
    const versions = data?.pages.flatMap((page) => page.data) ?? [];
    const total = data?.pages[0]?.total ?? 0;

    // Infinite scroll observer
    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useCallback(
        (node: HTMLDivElement | null) => {
            if (isFetchingNextPage) return;
            if (observerRef.current) observerRef.current.disconnect();

            observerRef.current = new IntersectionObserver((entries) => {
                if (entries[0]?.isIntersecting && hasNextPage) {
                    fetchNextPage();
                }
            });

            if (node) observerRef.current.observe(node);
        },
        [isFetchingNextPage, hasNextPage, fetchNextPage]
    );

    const handleRestore = async () => {
        if (!selectedVersion) return;

        try {
            await restoreMutation.mutateAsync({
                walkthroughId,
                versionId: selectedVersion
            });
            setShowConfirmDialog(false);
            setSelectedVersion(null);
            onClose();
        } catch (error) {
            console.error('Error restoring version:', error);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 transition-opacity"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="fixed right-0 top-0 h-full w-[500px] bg-background border-l border-border shadow-2xl z-50 flex flex-col animate-slide-in-right">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-background-secondary/50">
                    <div>
                        <h2 className="text-xl font-bold text-foreground">{t('title')}</h2>
                        <p className="text-sm text-foreground-muted mt-1">
                            {t('savedVersions', { count: total })}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-background-tertiary rounded-lg transition-colors text-foreground-muted hover:text-foreground"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : versions.length > 0 ? (
                        <div className="space-y-4">
                            {versions.map((version: WalkthroughVersion, index: number) => (
                                <div
                                    key={version.id}
                                    className="relative border border-border/50 rounded-lg p-4 hover:border-border hover:bg-background-secondary/50 transition-all duration-200 bg-background"
                                >
                                    {/* Timeline connector */}
                                    {index < versions.length - 1 && (
                                        <div className="absolute left-6 top-full h-4 w-0.5 bg-border/50" />
                                    )}

                                    <div className="flex items-start gap-4">
                                        {/* Version badge */}
                                        <div className="flex-shrink-0">
                                            <div className="w-10 h-10 rounded-full bg-background-tertiary border border-border flex items-center justify-center text-xs font-mono text-foreground-muted font-bold">
                                                v{version.versionNumber}
                                            </div>
                                        </div>

                                        {/* Version info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-medium text-foreground truncate">
                                                    {t('version', { number: version.versionNumber })} — {formatDate(version.createdAt)}
                                                </h3>
                                                {version.restoredFrom && (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                                                        <span className="text-[10px] font-bold tracking-wider uppercase text-green-500">
                                                            {t('restored')}
                                                        </span>
                                                    </div>
                                                )}
                                                {index === 0 && (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-accent-blue shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
                                                        <span className="text-[10px] font-bold tracking-wider uppercase text-accent-blue">
                                                            {t('current')}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3 text-xs text-foreground-muted mb-2">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {formatDate(version.createdAt)}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <div className="w-1 h-1 rounded-full bg-foreground-subtle" />
                                                    {t('stepsCount', { count: version.steps.length })}
                                                </span>
                                                {version.creator && (
                                                    <span className="flex items-center gap-1.5">
                                                        <UserAvatar
                                                            firstName={version.creator.firstName}
                                                            lastName={version.creator.lastName}
                                                            size="xs"
                                                            userInfo={{ email: version.creator.email }}
                                                        />
                                                        {`${version.creator.firstName} ${version.creator.lastName}`.trim()}
                                                    </span>
                                                )}
                                            </div>

                                            {version.isPublished && (
                                                <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                                                    <Check className="w-3 h-3" />
                                                    {tc('published')}
                                                </span>
                                            )}

                                            {/* Restore button */}
                                            {index !== 0 && (
                                                <button
                                                    onClick={() => {
                                                        setSelectedVersion(version.id);
                                                        setShowConfirmDialog(true);
                                                    }}
                                                    className="mt-3 w-full px-3 py-1.5 text-xs border border-border rounded-md hover:bg-background-secondary text-foreground-muted hover:text-foreground transition-all duration-200 font-medium flex items-center justify-center gap-2"
                                                >
                                                    <RotateCcw className="w-3 h-3" />
                                                    {t('restoreThisVersion')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Infinite scroll sentinel */}
                            <div ref={loadMoreRef} className="py-2 flex justify-center">
                                {isFetchingNextPage && (
                                    <Loader2 className="h-5 w-5 animate-spin text-foreground-muted" />
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-foreground-muted">
                            <History className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-lg font-medium">{t('noVersions')}</p>
                            <p className="text-sm mt-1">{t('noVersionsDescription')}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Confirmation Dialog */}
            {showConfirmDialog && (
                <div className="fixed inset-0 flex items-center justify-center z-[60]">
                    <div
                        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                        onClick={() => setShowConfirmDialog(false)}
                    />
                    <div className="relative bg-background border border-border rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 animate-scale-in">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-foreground">{t('restoreVersionTitle')}</h3>
                                <p className="text-sm text-foreground-muted mt-1">
                                    {t('restoreVersionDescription')}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowConfirmDialog(false)}
                                className="flex-1 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-background-secondary transition-colors font-medium text-sm"
                                disabled={restoreMutation.isPending}
                            >
                                {tc('cancel')}
                            </button>
                            <button
                                onClick={handleRestore}
                                disabled={restoreMutation.isPending}
                                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all duration-200 font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                {restoreMutation.isPending ? tc('restoring') : tc('confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes slide-in-right {
                    from {
                        transform: translateX(100%);
                    }
                    to {
                        transform: translateX(0);
                    }
                }

                @keyframes scale-in {
                    from {
                        transform: scale(0.95);
                        opacity: 0;
                    }
                    to {
                        transform: scale(1);
                        opacity: 1;
                    }
                }

                .animate-slide-in-right {
                    animation: slide-in-right 0.3s ease-out;
                }

                .animate-scale-in {
                    animation: scale-in 0.2s ease-out;
                }
            `}</style>
        </>
    );
}
