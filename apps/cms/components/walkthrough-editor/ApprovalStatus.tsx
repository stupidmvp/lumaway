'use client';

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
    Check,
    Clock,
    User as UserIcon,
    Shield,
    AlertCircle,
    ChevronDown,
    GitPullRequest
} from 'lucide-react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { UserAvatar } from '@/components/ui/user-avatar';
import { cn } from '@/lib/utils';
import { useProjectMembers } from '@luma/infra';
import { Separator } from '@/components/ui/separator';

interface ApprovalStatusProps {
    status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'published';
    approvals: any[]; // Full approval objects
    minApprovals: number;
    reviewerUserIds: string[];
    projectId: string;
    currentUserId?: string;
}

export function ApprovalStatus({
    status,
    approvals,
    minApprovals,
    reviewerUserIds,
    projectId,
    currentUserId
}: ApprovalStatusProps) {
    const t = useTranslations('Editor');
    const { data: membersResult } = useProjectMembers(projectId, undefined, 100);
    const members = membersResult?.data || [];

    // Calculate stats
    const approvedCount = approvals.length;
    const remaining = Math.max(0, minApprovals - approvedCount);
    const isApproved = status === 'approved' || status === 'published';

    // Determine specific reviewer status
    const reviewerStatusList = useMemo(() => {
        if (!reviewerUserIds || reviewerUserIds.length === 0) return [];

        return reviewerUserIds.map(id => {
            const member = members.find(m => m.userId === id);
            const approval = approvals.find(a => a.userId === id);
            return {
                id,
                user: member?.user,
                approved: !!approval,
                approvedAt: approval?.createdAt,
                isMe: currentUserId === id
            };
        });
    }, [reviewerUserIds, members, approvals, currentUserId]);

    // Color logic
    const statusColor = useMemo(() => {
        switch (status) {
            case 'approved':
            case 'published':
                return 'text-success bg-success/10 border-success/20';
            case 'rejected':
                return 'text-destructive bg-destructive/10 border-destructive/20';
            case 'pending_approval':
                return 'text-warning bg-warning/10 border-warning/20';
            default:
                return 'text-foreground-muted bg-foreground-muted/10 border-foreground-muted/20';
        }
    }, [status]);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors hover:bg-opacity-80 active:scale-95",
                        statusColor
                    )}
                >
                    <GitPullRequest className="h-3.5 w-3.5" />
                    <span>
                        {status === 'pending_approval'
                            ? `${approvedCount}/${minApprovals} ${t('approvals')}`
                            : t(`status${status.charAt(0).toUpperCase()}${status.slice(1).replace('_a', 'A')}` as any)
                        }
                    </span>
                    {status === 'pending_approval' && <ChevronDown className="h-3 w-3 opacity-50" />}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="p-3 border-b border-border/50 bg-background-secondary/50">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                        <Shield className="h-3.5 w-3.5 text-accent-blue" />
                        {t('approvalStatus')}
                    </h4>
                    <p className="text-xs text-foreground-muted mt-1">
                        {isApproved
                            ? t('versionApprovedDesc')
                            : t('reviewersRequiredDesc', { count: minApprovals })}
                    </p>
                </div>

                <div className="max-h-[300px] overflow-y-auto p-2">
                    {/* Specific Reviewers List */}
                    {reviewerStatusList.length > 0 ? (
                        <div className="space-y-1">
                            {reviewerStatusList.map((reviewer) => (
                                <div
                                    key={reviewer.id}
                                    className={cn(
                                        "flex items-center justify-between p-2 rounded-md",
                                        reviewer.isMe ? "bg-accent-blue/5 border border-accent-blue/20" : "hover:bg-background-secondary"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <UserAvatar
                                                firstName={reviewer.user?.firstName}
                                                lastName={reviewer.user?.lastName}
                                                avatar={reviewer.user?.avatar}
                                                size="sm"
                                            />
                                            <div className={cn(
                                                "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background flex items-center justify-center",
                                                reviewer.approved ? "bg-success text-white" : "bg-warning text-white"
                                            )}>
                                                {reviewer.approved ? <Check className="h-2 w-2" /> : <Clock className="h-2 w-2" />}
                                            </div>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">
                                                {reviewer.user
                                                    ? `${reviewer.user.firstName} ${reviewer.user.lastName}`
                                                    : t('unknownUser')}
                                                {reviewer.isMe && <span className="ml-1.5 text-[10px] text-foreground-muted">({t('you')})</span>}
                                            </span>
                                            <span className="text-[10px] text-foreground-muted">
                                                {reviewer.approved
                                                    ? t('approved')
                                                    : t('reviewPending')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* Generic Admin/Owner Approval */
                        <div className="p-3 text-center">
                            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-background-secondary mb-2">
                                <UserIcon className="h-5 w-5 text-foreground-muted" />
                            </div>
                            <p className="text-xs text-foreground-muted">
                                {t('noSpecificReviewers')}
                            </p>
                        </div>
                    )}

                    {/* General Approvals List (if any approved but not in reviewer list - edge case) */}
                    {approvals.length > 0 && reviewerStatusList.length === 0 && (
                        <div className="mt-2 space-y-1">
                            <p className="px-2 text-[10px] font-semibold text-foreground-muted uppercase tracking-wider mb-1">
                                {t('approvedBy')}
                            </p>
                            {approvals.map((approval: any) => (
                                <div key={approval.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-background-secondary">
                                    <UserAvatar
                                        firstName={approval.user?.firstName}
                                        lastName={approval.user?.lastName}
                                        avatar={approval.user?.avatar}
                                        size="xs"
                                    />
                                    <span className="text-xs font-medium">
                                        {approval.user?.firstName} {approval.user?.lastName}
                                    </span>
                                    <span className="ml-auto text-[10px] text-foreground-muted bg-background-tertiary px-1.5 py-0.5 rounded">
                                        {new Date(approval.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
