'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
    MoreHorizontal,
    Reply,
    Pencil,
    Trash2,
    Archive,
    RotateCcw,
    CheckCircle2,
    AlertCircle,
    Megaphone,
    Route,
    Download,
    File as FileIcon,
    FileText,
    FileSpreadsheet,
    FileImage,
    FileArchive,
    FileCode,
    FileAudio,
    Presentation,
    Play,
    Eye,
    Image as ImageIcon,
    X,
    ExternalLink,
    SmilePlus,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import { UserAvatar, type UserInfo } from '@/components/ui/user-avatar';
import {
    Popover,
    PopoverTrigger,
    PopoverContent,
} from '@/components/ui/popover';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTranslations } from 'next-intl';
import { useCurrentUser, useProjectMembers } from '@luma/infra';
import { cn } from '@/lib/utils';
import { ENV } from '@/lib/env';
import { toast } from 'sonner';
import type { Comment } from '@luma/infra';
import {
    FilePreviewDialog,
    isImage,
    isVideo,
    isPreviewable,
    type PreviewableFile,
} from './FilePreviewDialog';
import { CommentReactions } from './CommentReactions';

interface CommentItemProps {
    comment: Comment;
    projectId: string;
    replies?: Comment[];
    /** Opens the Slack-like thread panel for this comment */
    onOpenThread?: () => void;
    /** Triggers edit mode in the bottom CommentInput */
    onStartEdit?: (commentId: string, content: string) => void;
    onDelete?: (commentId: string) => Promise<void>;
    onArchive?: (commentId: string) => Promise<void>;
    onRestore?: (commentId: string) => Promise<void>;
    onResolve?: (commentId: string) => Promise<void>;
    onRemoveAttachment?: (commentId: string, attachmentId: string) => Promise<void>;
    onToggleReaction?: (commentId: string, emoji: string) => void;
    repliesCount?: number;
    isNested?: boolean;
    /** When true, renders inside a thread drawer — no left border, no avatar popover */
    isInThread?: boolean;
    /** When true, hides the hover action toolbar (reactions, reply, dropdown menu) */
    hideActions?: boolean;
    /** Map of stepId → { title, index } for showing step association */
    stepsMap?: Map<string, { title: string; index: number }>;
}

const TYPE_STYLES: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
    correction: { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20', label: 'correction' },
    announcement: { icon: Megaphone, color: 'text-accent-blue', bg: 'bg-accent-blue/10 border-accent-blue/20', label: 'announcement' },
};

/* ------------------------------------------------------------------ */
/* File type classification — Slack-style icons & colors               */
/* ------------------------------------------------------------------ */

interface FileTypeInfo {
    icon: React.ElementType;
    color: string;       // tailwind text color
    bg: string;          // tailwind bg for the icon area
    border: string;      // left-border accent color
    label: string;       // human-readable type label
}

const FILE_TYPE_MAP: Record<string, FileTypeInfo> = {
    // PDF
    pdf:  { icon: FileText, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-l-red-500', label: 'PDF' },
    // Word
    doc:  { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-600/10', border: 'border-l-blue-600', label: 'Word' },
    docx: { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-600/10', border: 'border-l-blue-600', label: 'Word' },
    odt:  { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-600/10', border: 'border-l-blue-600', label: 'Document' },
    rtf:  { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-600/10', border: 'border-l-blue-600', label: 'Rich Text' },
    // Excel / Spreadsheets
    xls:  { icon: FileSpreadsheet, color: 'text-green-600', bg: 'bg-green-600/10', border: 'border-l-green-600', label: 'Excel' },
    xlsx: { icon: FileSpreadsheet, color: 'text-green-600', bg: 'bg-green-600/10', border: 'border-l-green-600', label: 'Excel' },
    csv:  { icon: FileSpreadsheet, color: 'text-green-600', bg: 'bg-green-600/10', border: 'border-l-green-600', label: 'CSV' },
    ods:  { icon: FileSpreadsheet, color: 'text-green-600', bg: 'bg-green-600/10', border: 'border-l-green-600', label: 'Spreadsheet' },
    // Presentations
    ppt:  { icon: Presentation, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-l-orange-500', label: 'PowerPoint' },
    pptx: { icon: Presentation, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-l-orange-500', label: 'PowerPoint' },
    key:  { icon: Presentation, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-l-orange-500', label: 'Keynote' },
    // Archives
    zip:  { icon: FileArchive, color: 'text-amber-600', bg: 'bg-amber-600/10', border: 'border-l-amber-600', label: 'ZIP' },
    rar:  { icon: FileArchive, color: 'text-amber-600', bg: 'bg-amber-600/10', border: 'border-l-amber-600', label: 'RAR' },
    '7z': { icon: FileArchive, color: 'text-amber-600', bg: 'bg-amber-600/10', border: 'border-l-amber-600', label: '7-Zip' },
    tar:  { icon: FileArchive, color: 'text-amber-600', bg: 'bg-amber-600/10', border: 'border-l-amber-600', label: 'Archive' },
    gz:   { icon: FileArchive, color: 'text-amber-600', bg: 'bg-amber-600/10', border: 'border-l-amber-600', label: 'Archive' },
    // Code
    json: { icon: FileCode, color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-l-yellow-500', label: 'JSON' },
    xml:  { icon: FileCode, color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-l-yellow-500', label: 'XML' },
    html: { icon: FileCode, color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-l-orange-400', label: 'HTML' },
    css:  { icon: FileCode, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-l-blue-400', label: 'CSS' },
    js:   { icon: FileCode, color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-l-yellow-400', label: 'JavaScript' },
    ts:   { icon: FileCode, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-l-blue-500', label: 'TypeScript' },
    // Text
    txt:  { icon: FileText, color: 'text-foreground-muted', bg: 'bg-foreground/5', border: 'border-l-foreground/30', label: 'Text' },
    md:   { icon: FileText, color: 'text-foreground-muted', bg: 'bg-foreground/5', border: 'border-l-foreground/30', label: 'Markdown' },
    // Audio
    mp3:  { icon: FileAudio, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-l-purple-500', label: 'Audio' },
    wav:  { icon: FileAudio, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-l-purple-500', label: 'Audio' },
    ogg:  { icon: FileAudio, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-l-purple-500', label: 'Audio' },
    aac:  { icon: FileAudio, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-l-purple-500', label: 'Audio' },
    flac: { icon: FileAudio, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-l-purple-500', label: 'Audio' },
    // Images (fallback for non-renderable image types)
    svg:  { icon: FileImage, color: 'text-pink-500', bg: 'bg-pink-500/10', border: 'border-l-pink-500', label: 'SVG' },
    ai:   { icon: FileImage, color: 'text-orange-600', bg: 'bg-orange-600/10', border: 'border-l-orange-600', label: 'Illustrator' },
    psd:  { icon: FileImage, color: 'text-blue-700', bg: 'bg-blue-700/10', border: 'border-l-blue-700', label: 'Photoshop' },
    fig:  { icon: FileImage, color: 'text-violet-500', bg: 'bg-violet-500/10', border: 'border-l-violet-500', label: 'Figma' },
};

const DEFAULT_FILE_TYPE: FileTypeInfo = {
    icon: FileIcon,
    color: 'text-foreground-muted',
    bg: 'bg-foreground/5',
    border: 'border-l-foreground/20',
    label: 'File',
};

function getFileTypeInfo(fileName: string): FileTypeInfo {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return FILE_TYPE_MAP[ext] || DEFAULT_FILE_TYPE;
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Detects whether a comment string is composed exclusively of emoji characters
 * (no text, no mentions). Returns the emoji count for size scaling, or 0 if not emoji-only.
 */
function getEmojiOnlyCount(content: string): number {
    // If the content has mention tokens, it's not emoji-only
    if (/@\[[a-f0-9-]+\]/.test(content)) return 0;

    // Strip whitespace, variation selectors and ZWJ for the emptiness check
    const withoutEmoji = content.replace(
        /[\p{Extended_Pictographic}\p{Emoji_Component}\u200d\ufe0f\ufe0e\s]/gu,
        '',
    );
    if (withoutEmoji.length > 0 || content.trim().length === 0) return 0;

    // Count pictographic characters (base emoji) for size scaling
    const matches = content.match(/\p{Extended_Pictographic}/gu);
    return matches ? matches.length : 0;
}

function timeAgo(dateStr: string, t: any): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return t('justNow');
    if (diff < 3600) return t('minutesAgo', { count: Math.floor(diff / 60) });
    if (diff < 86400) return t('hoursAgo', { count: Math.floor(diff / 3600) });
    return t('daysAgo', { count: Math.floor(diff / 86400) });
}

/**
 * Renders content with @[userId] tokens replaced by clickable mention chips
 * that show user info in a popover (like UserAvatar).
 */
function RenderContent({
    content,
    mentions,
    members,
}: {
    content: string;
    mentions?: Comment['mentions'];
    members: Map<string, { firstName: string; lastName: string; email?: string; avatar?: string; role?: string }>;
}) {
    const parts = useMemo(() => {
        const regex = /@\[([a-f0-9-]+)\]/g;
        const result: { type: 'text' | 'mention'; value: string; userId?: string }[] = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(content)) !== null) {
            if (match.index > lastIndex) {
                result.push({ type: 'text', value: content.slice(lastIndex, match.index) });
            }
            result.push({ type: 'mention', value: match[1] || '', userId: match[1] || '' });
            lastIndex = regex.lastIndex;
        }

        if (lastIndex < content.length) {
            result.push({ type: 'text', value: content.slice(lastIndex) });
        }

        return result;
    }, [content]);

    return (
        <span className="whitespace-pre-wrap break-words">
            {parts.map((part, i) => {
                if (part.type === 'mention' && part.userId) {
                    const mentionUser = mentions?.find((m) => m.mentionedUserId === part.userId)?.user;
                    const memberInfo = members.get(part.userId);

                    const firstName = mentionUser?.firstName ?? memberInfo?.firstName ?? '';
                    const lastName = mentionUser?.lastName ?? memberInfo?.lastName ?? '';
                    const name = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';
                    const email = mentionUser?.email ?? memberInfo?.email;
                    const avatar = mentionUser?.avatar ?? memberInfo?.avatar;
                    const role = memberInfo?.role;

                    return (
                        <Popover key={i}>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-0.5 text-accent-blue font-medium bg-accent-blue/10 hover:bg-accent-blue/20 rounded px-1 py-0 mx-0.5 cursor-pointer transition-colors"
                                >
                                    @{name}
                                </button>
                            </PopoverTrigger>
                            <PopoverContent side="bottom" align="start" sideOffset={6} className="w-auto p-0">
                                <div className="flex items-center gap-3 p-3">
                                    {part.userId ? (
                                        <Link href={`/users/${part.userId}`} className="shrink-0">
                                            <UserAvatar
                                                firstName={firstName}
                                                lastName={lastName}
                                                avatar={avatar}
                                                size="lg"
                                                className="h-10 w-10 hover:opacity-80 transition-opacity"
                                            />
                                        </Link>
                                    ) : (
                                        <UserAvatar
                                            firstName={firstName}
                                            lastName={lastName}
                                            avatar={avatar}
                                            size="lg"
                                            className="h-10 w-10"
                                        />
                                    )}
                                    <div className="flex flex-col min-w-0">
                                        {name !== 'Unknown' && (
                                            part.userId ? (
                                                <Link
                                                    href={`/users/${part.userId}`}
                                                    className="text-sm font-semibold text-foreground truncate hover:text-accent-blue transition-colors"
                                                >
                                                    {name}
                                                </Link>
                                            ) : (
                                                <span className="text-sm font-semibold text-foreground truncate">
                                                    {name}
                                                </span>
                                            )
                                        )}
                                        {email && (
                                            <span className="text-xs text-foreground-muted truncate">
                                                {email}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {role && (
                                    <div className="px-3 pb-2.5 -mt-0.5">
                                        <span className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider">
                                            {role}
                                        </span>
                                    </div>
                                )}
                                {part.userId && (
                                    <div className="border-t border-border px-3 py-2">
                                        <Link
                                            href={`/users/${part.userId}`}
                                            className="flex items-center gap-1.5 text-[11px] font-medium text-accent-blue hover:text-accent-blue/80 transition-colors"
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                            View profile
                                        </Link>
                                    </div>
                                )}
                            </PopoverContent>
                        </Popover>
                    );
                }
                return <span key={i}>{part.value}</span>;
            })}
        </span>
    );
}

export function CommentItem({
    comment,
    projectId,
    replies,
    onOpenThread,
    onStartEdit,
    onDelete,
    onArchive,
    onRestore,
    onResolve,
    onRemoveAttachment,
    onToggleReaction,
    repliesCount = 0,
    isNested = false,
    isInThread = false,
    hideActions = false,
    stepsMap,
}: CommentItemProps) {
    const t = useTranslations('Comments');
    const tn = useTranslations('Notifications');
    const { data: currentUser } = useCurrentUser();
    const { data: membersData } = useProjectMembers(projectId, undefined, 100);

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [attachmentToRemove, setAttachmentToRemove] = useState<{ commentId: string; attachmentId: string; fileName: string } | null>(null);
    const [previewFile, setPreviewFile] = useState<PreviewableFile | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

    const isAuthor = currentUser?.id === comment.userId;
    const isDeleted = comment.status === 'deleted';
    const isArchived = comment.status === 'archived';

    // Build members map for mention resolution, role lookup & user info.
    // Also includes comment/reply authors as a fallback for users not in
    // the project_members table (e.g. superadmins with implicit access,
    // or self-mentions created before the fix).
    const membersMap = useMemo(() => {
        const map = new Map<string, { firstName: string; lastName: string; email?: string; avatar?: string; role?: string }>();

        // 1. Project members (canonical source)
        (membersData?.data || []).forEach((m: any) => {
            if (m.user) {
                map.set(m.userId, {
                    firstName: m.user.firstName,
                    lastName: m.user.lastName,
                    email: m.user.email,
                    avatar: m.user.avatar,
                    role: m.role,
                });
            }
        });

        // 2. Comment author (fallback for users not in project_members)
        if (comment.user && !map.has(comment.userId)) {
            map.set(comment.userId, {
                firstName: comment.user.firstName,
                lastName: comment.user.lastName,
                email: comment.user.email,
                avatar: comment.user.avatar,
            });
        }

        // 3. Reply authors (fallback)
        if (replies) {
            for (const reply of replies) {
                if (reply.user && !map.has(reply.userId)) {
                    map.set(reply.userId, {
                        firstName: reply.user.firstName,
                        lastName: reply.user.lastName,
                        email: reply.user.email,
                        avatar: reply.user.avatar,
                    });
                }
            }
        }

        return map;
    }, [membersData, comment.user, comment.userId, replies]);

    // Build rich userInfo for the avatar popup
    const commentUserInfo = useMemo(() => {
        if (!comment.user) return undefined;
        const member = membersMap.get(comment.userId);
        return {
            userId: comment.userId,
            email: comment.user.email,
            role: member?.role ?? undefined,
        };
    }, [comment.user, comment.userId, membersMap]);

    const typeStyle = TYPE_STYLES[comment.type];
    const userName = comment.user
        ? `${comment.user.firstName} ${comment.user.lastName}`.trim()
        : 'Unknown';

    // Detect emoji-only content for sticker-style rendering
    const emojiCount = useMemo(() => getEmojiOnlyCount(comment.content), [comment.content]);

    // Categorize attachments
    const attachments = (comment.attachments || []) as PreviewableFile[];
    const imageAttachments = attachments.filter(isImage);
    const videoAttachments = attachments.filter(isVideo);
    const fileAttachments = attachments.filter((f) => !isImage(f) && !isVideo(f));

    const handleOpenPreview = useCallback((file: PreviewableFile) => {
        setPreviewFile(file);
        setShowPreview(true);
    }, []);

    const handleDownload = useCallback(async (file: PreviewableFile) => {
        try {
            const response = await fetch(`${ENV.S3_URL_BASE}${file.s3Key}`);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = file.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch {
            toast.error(t('downloadError'));
        }
    }, [t]);

    return (
        <div
            id={`comment-${comment.id}`}
            className={cn(
                "group relative",
                isNested && !isInThread && "ml-8 pl-3 border-l-2 border-border/50",
            )}
        >
            {/* Type badge for corrections/announcements */}
            {typeStyle && !isNested && (
                <div className={cn(
                    "flex items-center gap-1.5 mb-1 px-2 py-0.5 rounded-md border w-fit text-[10px] font-bold uppercase tracking-wider",
                    typeStyle.bg, typeStyle.color
                )}>
                    <typeStyle.icon className="h-3 w-3" />
                    {t(typeStyle.label)}
                    {comment.type === 'correction' && comment.isResolved && (
                        <span className="flex items-center gap-0.5 text-green-600 ml-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {t('resolved')}
                        </span>
                    )}
                </div>
            )}

            <div className="flex items-start gap-2.5">
                <UserAvatar
                    firstName={comment.user?.firstName}
                    lastName={comment.user?.lastName}
                    avatar={comment.user?.avatar}
                    size={isNested ? 'xs' : 'sm'}
                    className={isNested ? 'mt-0.5' : 'mt-0'}
                    userInfo={isInThread ? undefined : commentUserInfo}
                    triggerMode={isInThread ? undefined : (isNested ? 'click' : 'hover')}
                />

                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-foreground truncate">
                            {userName}
                        </span>
                        <span className="text-[10px] text-foreground-muted shrink-0">
                            {timeAgo(comment.createdAt, tn)}
                        </span>
                        {comment.isEdited && (
                            <span className="text-[10px] text-foreground-subtle italic">
                                ({t('edited')})
                            </span>
                        )}
                    </div>

                    {/* Step association badge — resolve from stepsMap or fallback to API-populated stepInfo */}
                    {!isNested && comment.stepId && (() => {
                        const fromMap = stepsMap?.get(comment.stepId!);
                        const resolved = fromMap || comment.stepInfo;
                        if (!resolved) return null;
                        const walkthroughId = comment.targetId;
                        const stepBadge = (
                            <span className={cn(
                                "inline-flex items-center gap-1 text-[10px] font-medium text-purple-600 dark:text-purple-400 bg-purple-500/10 rounded px-1.5 py-0.5",
                                walkthroughId && "hover:bg-purple-500/20 transition-colors cursor-pointer"
                            )}>
                                <Route className="h-3 w-3" />
                                {t('stepLabel', { number: resolved.index + 1, title: resolved.title })}
                            </span>
                        );
                        return (
                            <div className="flex items-center gap-1 mb-1">
                                {walkthroughId ? (
                                    <Link href={`/walkthroughs/${walkthroughId}/steps?stepId=${comment.stepId}`}>
                                        {stepBadge}
                                    </Link>
                                ) : stepBadge}
                            </div>
                        );
                    })()}

                    {/* Content */}
                    {isDeleted ? (
                        <p className="text-xs text-foreground-muted italic">{t('deleted')}</p>
                    ) : (
                        <div className={cn(
                            "text-foreground leading-relaxed",
                            isArchived && "opacity-60",
                            emojiCount > 0 && emojiCount <= 2 && "text-4xl leading-none py-0.5",
                            emojiCount >= 3 && emojiCount <= 4 && "text-2xl leading-none py-0.5",
                            emojiCount >= 5 && "text-xl leading-tight",
                            emojiCount === 0 && "text-xs",
                        )}>
                            <RenderContent
                                content={comment.content}
                                mentions={comment.mentions}
                                members={membersMap}
                            />
                        </div>
                    )}

                    {/* Attachments */}
                    {!isDeleted && attachments.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                            {/* Image thumbnails grid */}
                            {imageAttachments.length > 0 && (
                                <div className={cn(
                                    "grid gap-1.5",
                                    imageAttachments.length === 1 && "grid-cols-1 max-w-[240px]",
                                    imageAttachments.length === 2 && "grid-cols-2 max-w-[320px]",
                                    imageAttachments.length >= 3 && "grid-cols-3 max-w-[380px]",
                                )}>
                                    {imageAttachments.map((att) => (
                                        <div key={att.id} className="group/thumb relative overflow-hidden rounded-lg border border-border/50 hover:border-border transition-all cursor-pointer bg-foreground/[0.02]">
                                            <button
                                                onClick={() => handleOpenPreview(att)}
                                                className="w-full"
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={`${ENV.S3_URL_BASE}${att.s3Key}`}
                                                    alt={att.fileName}
                                                    className={cn(
                                                        "w-full object-cover transition-transform duration-200 group-hover/thumb:scale-105",
                                                        imageAttachments.length === 1 ? "max-h-[200px]" : "h-[100px]",
                                                    )}
                                                    loading="lazy"
                                                />
                                                {/* Overlay on hover */}
                                                <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
                                                    <div className="opacity-0 group-hover/thumb:opacity-100 transition-opacity bg-black/50 rounded-full p-1.5">
                                                        <Eye className="h-3.5 w-3.5 text-white" />
                                                    </div>
                                                </div>
                                            </button>
                                            {/* Remove button */}
                                            {isAuthor && onRemoveAttachment && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAttachmentToRemove({ commentId: comment.id, attachmentId: att.id, fileName: att.fileName });
                                                    }}
                                                    className="absolute top-1 right-1 z-10 p-0.5 rounded-full bg-black/60 hover:bg-red-500 text-white opacity-0 group-hover/thumb:opacity-100 transition-all cursor-pointer"
                                                    title={t('removeAttachment')}
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Video thumbnails */}
                            {videoAttachments.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {videoAttachments.map((att) => (
                                        <div
                                            key={att.id}
                                            className="group/thumb relative overflow-hidden rounded-lg border border-border/50 hover:border-border transition-all cursor-pointer bg-black/5 dark:bg-white/5 w-[200px] h-[120px]"
                                        >
                                            <button
                                                onClick={() => handleOpenPreview(att)}
                                                className="w-full h-full"
                                            >
                                                {/* Video preview with poster-like appearance */}
                                                <video
                                                    src={`${ENV.S3_URL_BASE}${att.s3Key}`}
                                                    className="w-full h-full object-cover"
                                                    preload="metadata"
                                                    muted
                                                />
                                                {/* Play icon overlay */}
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/thumb:bg-black/30 transition-colors pointer-events-none">
                                                    <div className="bg-black/60 rounded-full p-2 group-hover/thumb:scale-110 transition-transform">
                                                        <Play className="h-4 w-4 text-white fill-white" />
                                                    </div>
                                                </div>
                                                {/* File name label */}
                                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1 pointer-events-none">
                                                    <span className="text-[9px] text-white/90 truncate block">{att.fileName}</span>
                                                </div>
                                            </button>
                                            {/* Remove button */}
                                            {isAuthor && onRemoveAttachment && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAttachmentToRemove({ commentId: comment.id, attachmentId: att.id, fileName: att.fileName });
                                                    }}
                                                    className="absolute top-1 right-1 z-10 p-0.5 rounded-full bg-black/60 hover:bg-red-500 text-white opacity-0 group-hover/thumb:opacity-100 transition-all cursor-pointer"
                                                    title={t('removeAttachment')}
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* File attachments — Slack-style rich cards */}
                            {fileAttachments.length > 0 && (
                                <div className="flex flex-col gap-1.5">
                                    {fileAttachments.map((att) => {
                                        const ft = getFileTypeInfo(att.fileName);
                                        const IconComponent = ft.icon;

                                        return (
                                            <div
                                                key={att.id}
                                                className={cn(
                                                    "group/file relative flex items-stretch rounded-md border border-border/60 bg-background overflow-hidden max-w-[320px]",
                                                    "hover:border-border hover:shadow-sm transition-all",
                                                    "border-l-[3px]",
                                                    ft.border,
                                                )}
                                            >
                                                {/* Clickable body */}
                                                <button
                                                    onClick={() => handleOpenPreview(att)}
                                                    className="flex items-center gap-2.5 px-3 py-2 flex-1 min-w-0 text-left cursor-pointer"
                                                >
                                                    {/* File type icon */}
                                                    <div className={cn(
                                                        "shrink-0 flex items-center justify-center w-8 h-8 rounded-md",
                                                        ft.bg,
                                                    )}>
                                                        <IconComponent className={cn("h-4 w-4", ft.color)} />
                                                    </div>

                                                    {/* File info */}
                                                    <div className="flex flex-col min-w-0 gap-0">
                                                        <span className="text-[11px] font-medium text-foreground truncate leading-tight">
                                                            {att.fileName}
                                                        </span>
                                                        <span className="text-[10px] text-foreground-muted leading-tight">
                                                            {ft.label} · {formatFileSize(att.fileSize)}
                                                        </span>
                                                    </div>
                                                </button>

                                                {/* Action buttons — visible on hover */}
                                                <div className="flex items-center gap-0.5 pr-1.5 opacity-0 group-hover/file:opacity-100 transition-opacity shrink-0">
                                                    <TooltipProvider delayDuration={200}>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <button
                                                                    onClick={() => handleDownload(att)}
                                                                    className="p-1 rounded hover:bg-foreground/10 text-foreground-subtle hover:text-foreground transition-colors cursor-pointer"
                                                                >
                                                                    <Download className="h-3.5 w-3.5" />
                                                                </button>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top" className="text-xs">{t('downloadFile')}</TooltipContent>
                                                        </Tooltip>

                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <button
                                                                    onClick={() => handleOpenPreview(att)}
                                                                    className="p-1 rounded hover:bg-foreground/10 text-foreground-subtle hover:text-foreground transition-colors cursor-pointer"
                                                                >
                                                                    <Eye className="h-3.5 w-3.5" />
                                                                </button>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top" className="text-xs">{t('previewFile')}</TooltipContent>
                                                        </Tooltip>

                                                        {isAuthor && onRemoveAttachment && (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <button
                                                                        onClick={() => setAttachmentToRemove({ commentId: comment.id, attachmentId: att.id, fileName: att.fileName })}
                                                                        className="p-1 rounded hover:bg-red-500/10 text-foreground-subtle hover:text-red-500 transition-colors cursor-pointer"
                                                                    >
                                                                        <X className="h-3.5 w-3.5" />
                                                                    </button>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="top" className="text-xs">{t('removeAttachment')}</TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                    </TooltipProvider>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Unified action bar — replies, reactions & tool actions on a single row */}
                    {!isDeleted && !hideActions && (
                        <div className="flex items-center mt-1.5 gap-2">
                            {/* Replies — stacked author avatars + count */}
                            {!isNested && repliesCount > 0 && (() => {
                                const uniqueAuthors = new Map<string, { firstName?: string; lastName?: string; avatar?: string }>();
                                (replies || []).forEach((r) => {
                                    if (r.user && !uniqueAuthors.has(r.userId)) {
                                        uniqueAuthors.set(r.userId, {
                                            firstName: r.user.firstName,
                                            lastName: r.user.lastName,
                                            avatar: r.user.avatar,
                                        });
                                    }
                                });
                                const authors = Array.from(uniqueAuthors.values()).slice(0, 4);
                                const extraAuthors = uniqueAuthors.size - authors.length;
                                const ExpandIcon = isExpanded ? ChevronUp : ChevronDown;

                                return (
                                    <button
                                        onClick={() => setIsExpanded((prev) => !prev)}
                                        className="flex items-center gap-1.5 text-[10px] text-accent-blue hover:text-accent-blue/80 font-medium transition-colors cursor-pointer group/replies"
                                    >
                                        <div className="flex items-center -space-x-1.5">
                                            {authors.map((author, idx) => (
                                                <UserAvatar
                                                    key={idx}
                                                    firstName={author.firstName}
                                                    lastName={author.lastName}
                                                    avatar={author.avatar}
                                                    size="xs"
                                                    className="h-4 w-4 ring-1 ring-background"
                                                />
                                            ))}
                                            {extraAuthors > 0 && (
                                                <span className="flex items-center justify-center h-4 w-4 rounded-full bg-foreground/10 text-[8px] font-bold text-foreground-muted ring-1 ring-background">
                                                    +{extraAuthors}
                                                </span>
                                            )}
                                        </div>
                                        <span className="group-hover/replies:underline">
                                            {repliesCount === 1
                                                ? t('replyCount_one', { count: repliesCount })
                                                : t('replyCount_other', { count: repliesCount })
                                            }
                                        </span>
                                        <ExpandIcon className="h-3 w-3" />
                                    </button>
                                );
                            })()}

                            {/* Reactions — inline pills */}
                            {(comment.reactions?.length ?? 0) > 0 && (
                                <CommentReactions
                                    reactions={comment.reactions || []}
                                    currentUserId={currentUser?.id}
                                    onToggleReaction={(emoji) => onToggleReaction?.(comment.id, emoji)}
                                    disabled={!onToggleReaction}
                                    hideAddButton
                                />
                            )}

                            {/* Tool actions — appear on hover */}
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <TooltipProvider delayDuration={300}>
                                    {/* Emoji react */}
                                    {onToggleReaction && (
                                        <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <PopoverTrigger asChild>
                                                        <button className="inline-flex items-center justify-center h-6 w-6 rounded-md text-foreground-muted/60 hover:text-foreground-muted hover:bg-foreground/[0.06] transition-colors cursor-pointer">
                                                            <SmilePlus className="h-3.5 w-3.5" />
                                                        </button>
                                                    </PopoverTrigger>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="text-xs">{t('addReaction')}</TooltipContent>
                                            </Tooltip>
                                            <PopoverContent align="start" side="top" sideOffset={4} className="w-auto p-2">
                                                <div className="grid grid-cols-5 gap-1">
                                                    {['👍', '👎', '❤️', '😄', '😮', '🎉', '🤔', '👀', '🚀', '✅', '💯', '👏', '🔥', '💡', '⭐'].map((emoji) => (
                                                        <button
                                                            key={emoji}
                                                            onClick={() => {
                                                                onToggleReaction(comment.id, emoji);
                                                                setEmojiPickerOpen(false);
                                                            }}
                                                            className="flex items-center justify-center w-8 h-8 rounded-md text-base hover:bg-foreground/[0.08] transition-colors cursor-pointer"
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    )}

                                    {/* Reply — opens thread panel */}
                                    {!isNested && onOpenThread && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    onClick={onOpenThread}
                                                    className="inline-flex items-center justify-center h-6 w-6 rounded-md text-foreground-muted/60 hover:text-foreground-muted hover:bg-foreground/[0.06] transition-colors cursor-pointer"
                                                >
                                                    <Reply className="h-3.5 w-3.5" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-xs">{t('reply')}</TooltipContent>
                                        </Tooltip>
                                    )}

                                    {/* Resolve correction */}
                                    {comment.type === 'correction' && !comment.isResolved && onResolve && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    onClick={() => onResolve(comment.id)}
                                                    className="inline-flex items-center justify-center h-6 w-6 rounded-md text-amber-500/70 hover:text-amber-500 hover:bg-amber-500/10 transition-colors cursor-pointer"
                                                >
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-xs">{t('resolveCorrection')}</TooltipContent>
                                        </Tooltip>
                                    )}

                                    {/* More actions dropdown */}
                                    <DropdownMenu>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <DropdownMenuTrigger asChild>
                                                    <button className="inline-flex items-center justify-center h-6 w-6 rounded-md text-foreground-muted/60 hover:text-foreground-muted hover:bg-foreground/[0.06] transition-colors cursor-pointer">
                                                        <MoreHorizontal className="h-3.5 w-3.5" />
                                                    </button>
                                                </DropdownMenuTrigger>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-xs">{t('moreActions')}</TooltipContent>
                                        </Tooltip>
                                        <DropdownMenuContent align="end" className="w-40">
                                            {isAuthor && !isArchived && onStartEdit && (
                                                <DropdownMenuItem
                                                    onClick={() => onStartEdit(comment.id, comment.content)}
                                                    className="text-xs cursor-pointer"
                                                >
                                                    <Pencil className="h-3.5 w-3.5 mr-2" />
                                                    {t('editComment')}
                                                </DropdownMenuItem>
                                            )}
                                            {onArchive && !isArchived && (
                                                <DropdownMenuItem
                                                    onClick={() => onArchive(comment.id)}
                                                    className="text-xs cursor-pointer"
                                                >
                                                    <Archive className="h-3.5 w-3.5 mr-2" />
                                                    {t('archiveComment')}
                                                </DropdownMenuItem>
                                            )}
                                            {onRestore && isArchived && (
                                                <DropdownMenuItem
                                                    onClick={() => onRestore(comment.id)}
                                                    className="text-xs cursor-pointer"
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5 mr-2" />
                                                    {t('restoreComment')}
                                                </DropdownMenuItem>
                                            )}
                                            {onDelete && (
                                                <>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => setShowDeleteConfirm(true)}
                                                        className="text-xs text-destructive cursor-pointer"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                                                        {t('deleteComment')}
                                                    </DropdownMenuItem>
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TooltipProvider>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Inline expanded replies */}
            {isExpanded && !isNested && replies && replies.length > 0 && (
                <div className="mt-2 ml-8 pl-3 border-l-2 border-border/40 space-y-2">
                    {replies.map((reply) => (
                        <CommentItem
                            key={reply.id}
                            comment={reply}
                            projectId={projectId}
                            isNested
                            stepsMap={stepsMap}
                            onStartEdit={onStartEdit}
                            onDelete={onDelete}
                            onArchive={onArchive}
                            onRestore={onRestore}
                            onRemoveAttachment={onRemoveAttachment}
                            onToggleReaction={onToggleReaction}
                        />
                    ))}
                </div>
            )}

            {/* Delete confirmation dialog */}
            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteConfirmTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('deleteConfirmDescription')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                onDelete?.(comment.id);
                                setShowDeleteConfirm(false);
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
                        >
                            {t('deleteComment')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Remove attachment confirmation dialog */}
            <AlertDialog open={!!attachmentToRemove} onOpenChange={(open) => { if (!open) setAttachmentToRemove(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('removeAttachmentConfirmTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('removeAttachmentConfirmDescription', { fileName: attachmentToRemove?.fileName ?? '' })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="cursor-pointer">{t('cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (attachmentToRemove) {
                                    onRemoveAttachment?.(attachmentToRemove.commentId, attachmentToRemove.attachmentId);
                                }
                                setAttachmentToRemove(null);
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
                        >
                            {t('removeAttachment')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* File preview dialog */}
            <FilePreviewDialog
                open={showPreview}
                onOpenChange={setShowPreview}
                file={previewFile}
                files={attachments}
                onNavigate={setPreviewFile}
            />
        </div>
    );
}
