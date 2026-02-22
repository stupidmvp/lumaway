'use client';


import React from 'react';
import Link from 'next/link';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, Globe, FileEdit, Loader2, Lock } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { ApprovalStatus } from './ApprovalStatus';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface EditorHeaderProps {
    hasVersions: boolean;
    onOpenVersionHistory: () => void;
    canEdit: boolean;
    /** Whether the user can publish/unpublish (gated by project settings) */
    canPublish?: boolean;
    isPublished: boolean;
    isPending: boolean;
    /** Parent walkthrough ID — shows a back arrow when present */
    parentId?: string | null;
    onTogglePublish: () => void;
    onSave: () => void;
    // Approval Workflow Props
    approvalRequired?: boolean;
    versionStatus?: string;
    approvalsCount?: number;
    minApprovals?: number;
    canRequestApproval?: boolean;
    canApprove?: boolean;
    canReject?: boolean;
    onRequestApproval?: () => void;
    onApprove?: () => void;
    onReject?: () => void;
    reviewerUserIds?: string[];
    approvals?: any[];
    currentUserId?: string;
    projectId?: string;
}

export const EditorHeader = React.memo(function EditorHeader({
    hasVersions,
    onOpenVersionHistory,
    canEdit,
    canPublish = true,
    isPublished,
    isPending,
    parentId,
    onTogglePublish,
    onSave,
    approvalRequired,
    versionStatus,
    approvalsCount,
    minApprovals,
    canRequestApproval,
    canApprove,
    canReject,
    onRequestApproval,
    onApprove,
    onReject,
    reviewerUserIds,
    approvals,
    currentUserId,
    projectId,
}: EditorHeaderProps) {
    const t = useTranslations('Editor');
    const tc = useTranslations('Common');
    const locale = useLocale();

    return (
        <header className="h-12 bg-background border-b border-border flex justify-between items-center px-2 sm:px-3 shadow-sm z-20 shrink-0">
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                {parentId && (
                    <Link
                        href={`/${locale}/walkthroughs/${parentId}`}
                        className="flex items-center justify-center h-7 w-7 rounded-md text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors shrink-0"
                        title={t('goToParent')}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                )}
                <Breadcrumb />
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
                {/* Approval Status */}
                {approvalRequired && hasVersions && (
                    <ApprovalStatus
                        status={versionStatus as any}
                        approvals={approvals || []}
                        minApprovals={minApprovals || 1}
                        reviewerUserIds={reviewerUserIds || []}
                        projectId={projectId || ''}
                        currentUserId={currentUserId}
                    />
                )}

                {/* Version History — only after first save */}
                {hasVersions && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onOpenVersionHistory}
                        className="gap-1.5 h-8 px-2 lg:px-3"
                    >
                        <Clock className="h-3.5 w-3.5" />
                        <span className="hidden lg:inline text-xs">{t('versionHistory')}</span>
                    </Button>
                )}

                {canEdit && (
                    <>
                        {/* Approval Actions */}
                        {canRequestApproval && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={onRequestApproval}
                                className="h-8 px-2 lg:px-3 text-xs"
                            >
                                {t('submitForReview')}
                            </Button>
                        )}

                        {canApprove && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onApprove}
                                className="h-8 px-2 lg:px-3 text-xs border-success/50 hover:border-success hover:bg-success/5 text-success"
                            >
                                {t('approve')}
                            </Button>
                        )}

                        {canReject && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onReject}
                                className="h-8 px-2 lg:px-3 text-xs border-destructive/50 hover:border-destructive hover:bg-destructive/5 text-destructive"
                            >
                                {t('reject')}
                            </Button>
                        )}

                        {/* Publish/Draft — only after first save, gated by project settings canPublish */}
                        {hasVersions && canPublish && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span tabIndex={0}> {/* Span needed to wrap disabled button for tooltip */}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={isPending || (approvalRequired && versionStatus !== 'approved' && versionStatus !== 'published')}
                                            onClick={onTogglePublish}
                                            className="gap-1.5 h-8 px-2 lg:px-3"
                                        >
                                            {isPending ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : isPublished ? (
                                                <FileEdit className="h-3.5 w-3.5" />
                                            ) : (approvalRequired && versionStatus !== 'approved') ? (
                                                <Lock className="h-3.5 w-3.5 opacity-70" />
                                            ) : (
                                                <Globe className="h-3.5 w-3.5" />
                                            )}
                                            <span className="hidden lg:inline text-xs">
                                                {isPublished
                                                    ? (isPending ? t('publishing') : t('markAsDraft'))
                                                    : (isPending ? t('markingAsDraft') : t('publish'))
                                                }
                                            </span>
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                {approvalRequired && versionStatus !== 'approved' && !isPublished && (
                                    <TooltipContent>
                                        <p>{t('approvalRequiredTooltip')}</p>
                                    </TooltipContent>
                                )}
                            </Tooltip>
                        )}
                        <Button
                            onClick={onSave}
                            size="sm"
                            disabled={isPending}
                            className="gap-1.5 shadow-sm h-8 px-2 lg:px-3"
                        >
                            {isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <FileEdit className="h-3.5 w-3.5 lg:hidden" />
                            )}
                            <span className="hidden lg:inline text-xs">{isPending ? tc('saving') : t('saveChanges')}</span>
                        </Button>
                    </>
                )}
            </div>
        </header>
    );
});
