'use client';

import { useState, useRef, useCallback, useEffect, KeyboardEvent, useImperativeHandle, forwardRef } from 'react';
import { Send, AlertCircle, Megaphone, Loader2, AtSign, X, Reply, Smile, Paperclip, File as FileIcon, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import {
    Popover,
    PopoverAnchor,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCurrentUser, useProjectMembers } from '@luma/infra';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import type { CommentType } from '@luma/infra';
import { FileUpload, type FileWithProgress } from '@/components/ui/file-upload';
import { toast } from 'sonner';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

interface MemberSuggestion {
    id: string;
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
}

export interface ReplyingTo {
    commentId: string;
    userName: string;
}

export interface EditingComment {
    id: string;
    content: string;
}

export interface CommentInputHandle {
    focus: () => void;
    startEditing: (comment: EditingComment) => void;
}

export interface PendingAttachment {
    fileName: string;
    fileType: string;
    fileSize: number;
    s3Key: string;
}

interface CommentInputProps {
    projectId: string;
    placeholder?: string;
    onSubmit: (content: string, type: CommentType, attachments?: PendingAttachment[]) => Promise<void>;
    /** Called when the user submits an edit (commentId, newContent) */
    onEditSubmit?: (commentId: string, content: string) => Promise<void>;
    isSubmitting?: boolean;
    showTypeSelector?: boolean;
    defaultType?: CommentType;
    compact?: boolean;
    /** When set, the input is in "reply mode" */
    replyingTo?: ReplyingTo | null;
    /** Callback to cancel replying */
    onCancelReply?: () => void;
    /** When set, the input is in "edit mode" */
    editingComment?: EditingComment | null;
    /** Callback to cancel editing */
    onCancelEdit?: () => void;
}

/**
 * Converts display content (with @FirstName LastName) back to wire format (@[userId])
 * before sending to the API.
 */
function toWireFormat(displayContent: string, mentionMap: Map<string, string>): string {
    let result = displayContent;
    // Sort by longest name first to avoid partial replacements
    const entries = Array.from(mentionMap.entries()).sort((a, b) => b[0].length - a[0].length);
    for (const [displayName, userId] of entries) {
        result = result.replaceAll(`@${displayName}`, `@[${userId}]`);
    }
    return result;
}

export const CommentInput = forwardRef<CommentInputHandle, CommentInputProps>(function CommentInput({
    projectId,
    placeholder,
    onSubmit,
    onEditSubmit,
    isSubmitting = false,
    showTypeSelector = false,
    defaultType = 'comment',
    compact = false,
    replyingTo,
    onCancelReply,
    editingComment,
    onCancelEdit,
}, ref) {
    const t = useTranslations('Comments');
    const { data: currentUser } = useCurrentUser();
    const { resolvedTheme } = useTheme();
    // Include owner so all project collaborators appear in mention popup
    const { data: membersData } = useProjectMembers(projectId, undefined, 100, 0, { includeOwner: true });

    const [content, setContent] = useState('');
    const [commentType, setCommentType] = useState<CommentType>(defaultType);
    const [showMentions, setShowMentions] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0);
    const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    // Maps display name -> userId for converting back on submit
    const mentionMapRef = useRef<Map<string, string>>(new Map());

    // Expose focus & startEditing methods to parent
    useImperativeHandle(ref, () => ({
        focus: () => {
            textareaRef.current?.focus();
        },
        startEditing: (comment: EditingComment) => {
            setContent(comment.content);
            setTimeout(() => {
                textareaRef.current?.focus();
                // Place cursor at end
                const len = comment.content.length;
                textareaRef.current?.setSelectionRange(len, len);
            }, 0);
        },
    }));

    // When editingComment changes externally, populate the input
    useEffect(() => {
        if (editingComment) {
            setContent(editingComment.content);
            setTimeout(() => {
                textareaRef.current?.focus();
                const len = editingComment.content.length;
                textareaRef.current?.setSelectionRange(len, len);
            }, 50);
        }
    }, [editingComment?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const members: MemberSuggestion[] = (membersData?.data || []).map((m: any) => ({
        id: m.id,
        userId: m.userId,
        firstName: m.user?.firstName || '',
        lastName: m.user?.lastName || '',
        email: m.user?.email || '',
        avatar: m.user?.avatar,
    }));

    const filteredMembers = members.filter((m) => {
        if (!mentionQuery) return true;
        const q = mentionQuery.toLowerCase();
        return (
            m.firstName.toLowerCase().includes(q) ||
            m.lastName.toLowerCase().includes(q) ||
            m.email.toLowerCase().includes(q)
        );
    });

    const handleContentChange = (value: string) => {
        setContent(value);

        // Detect @mention trigger
        const textarea = textareaRef.current;
        if (!textarea) return;

        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = value.substring(0, cursorPos);
        const atMatch = textBeforeCursor.match(/@(\w*)$/);

        if (atMatch) {
            setShowMentions(true);
            setMentionQuery(atMatch[1] || '');
            setMentionIndex(0);
        } else {
            setShowMentions(false);
            setMentionQuery('');
        }
    };

    const insertEmoji = useCallback(
        (emoji: { native: string }) => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            const cursorPos = textarea.selectionStart;
            const before = content.substring(0, cursorPos);
            const after = content.substring(cursorPos);
            const newContent = before + emoji.native + after;

            setContent(newContent);
            setShowEmojiPicker(false);

            // Focus back and set cursor after the emoji
            setTimeout(() => {
                textarea.focus();
                const newPos = cursorPos + emoji.native.length;
                textarea.setSelectionRange(newPos, newPos);
            }, 0);
        },
        [content],
    );

    const insertMention = useCallback(
        (member: MemberSuggestion) => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            const cursorPos = textarea.selectionStart;
            const textBeforeCursor = content.substring(0, cursorPos);
            const textAfterCursor = content.substring(cursorPos);
            const atIndex = textBeforeCursor.lastIndexOf('@');

            const displayName = `${member.firstName} ${member.lastName}`.trim();
            const mentionText = `@${displayName} `;
            const newContent =
                textBeforeCursor.substring(0, atIndex) + mentionText + textAfterCursor;

            // Store the mapping for submit conversion
            mentionMapRef.current.set(displayName, member.userId);

            setContent(newContent);
            setShowMentions(false);
            setMentionQuery('');

            // Focus back and set cursor position
            setTimeout(() => {
                textarea.focus();
                const newPos = atIndex + mentionText.length;
                textarea.setSelectionRange(newPos, newPos);
            }, 0);
        },
        [content],
    );

    const handleFileUploadSuccess = useCallback((uploadedFiles: FileWithProgress[]) => {
        const newAttachments: PendingAttachment[] = uploadedFiles
            .filter((f) => f.fileUrl)
            .map((f) => ({
                fileName: f.file.name,
                fileType: f.file.type || 'application/octet-stream',
                fileSize: f.file.size,
                s3Key: f.fileUrl!,
            }));
        setPendingAttachments((prev) => [...prev, ...newAttachments]);
        setIsUploading(false);
    }, []);

    const handleFileUploadError = useCallback(() => {
        toast.error(t('attachmentUploadFailed'));
        setIsUploading(false);
    }, [t]);

    const removeAttachment = useCallback((index: number) => {
        setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (showMentions && filteredMembers.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex((prev) =>
                    Math.min(prev + 1, filteredMembers.length - 1),
                );
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex((prev) => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                const member = filteredMembers[mentionIndex];
                if (member) insertMention(member);
            } else if (e.key === 'Escape') {
                setShowMentions(false);
            }
            return;
        }

        // Cancel editing with Escape
        if (e.key === 'Escape' && editingComment && onCancelEdit) {
            e.preventDefault();
            onCancelEdit();
            setContent('');
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
            return;
        }

        // Submit with Ctrl+Enter or Cmd+Enter
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleSubmit = async () => {
        const trimmed = content.trim();
        if ((!trimmed && pendingAttachments.length === 0) || isSubmitting) return;

        // Convert display names back to @[userId] wire format
        const wireContent = toWireFormat(trimmed, mentionMapRef.current);

        // If editing, call the edit handler instead of create
        if (editingComment && onEditSubmit) {
            await onEditSubmit(editingComment.id, wireContent);
            onCancelEdit?.();
        } else {
            await onSubmit(
                wireContent,
                commentType,
                pendingAttachments.length > 0 ? pendingAttachments : undefined,
            );
        }

        setContent('');
        setCommentType(defaultType);
        setPendingAttachments([]);
        mentionMapRef.current.clear();

        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, compact ? 80 : 120)}px`;
    }, [content, compact]);

    const typeOptions: {
        value: CommentType;
        label: string;
        icon: React.ElementType;
        color: string;
        activeColor: string;
    }[] = [
            {
                value: 'comment',
                label: t('typeComment'),
                icon: Send,
                color: 'text-foreground-subtle',
                activeColor: 'text-foreground-muted bg-foreground/5',
            },
            {
                value: 'correction',
                label: t('typeCorrection'),
                icon: AlertCircle,
                color: 'text-foreground-subtle',
                activeColor: 'text-amber-500 bg-amber-500/10',
            },
            {
                value: 'announcement',
                label: t('typeAnnouncement'),
                icon: Megaphone,
                color: 'text-foreground-subtle',
                activeColor: 'text-accent-blue bg-accent-blue/10',
            },
        ];

    return (
        <Popover open={showMentions} onOpenChange={(open) => !open && setShowMentions(false)}>
            <PopoverAnchor asChild>
                <div
                    className={cn(
                        'transition-colors',
                        compact ? 'py-1' : 'py-2',
                    )}
                >
                    {/* Editing indicator */}
                    {editingComment && (
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-amber-500/30">
                            <Pencil className="h-3 w-3 text-amber-500 shrink-0" />
                            <span className="text-[11px] text-foreground-muted leading-none">
                                {t('editingComment')}
                            </span>
                            {onCancelEdit && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onCancelEdit();
                                        setContent('');
                                        if (textareaRef.current) {
                                            textareaRef.current.style.height = 'auto';
                                        }
                                    }}
                                    className="ml-auto p-0.5 rounded hover:bg-foreground/5 text-foreground-muted hover:text-foreground transition-colors cursor-pointer"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Reply indicator */}
                    {!editingComment && replyingTo && (
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/30">
                            <Reply className="h-3 w-3 text-accent-blue shrink-0" />
                            <span className="text-[11px] text-foreground-muted leading-none">
                                {t('replyingTo')}{' '}
                                <span className="font-semibold text-foreground">{replyingTo.userName}</span>
                            </span>
                            {onCancelReply && (
                                <button
                                    type="button"
                                    onClick={onCancelReply}
                                    className="ml-auto p-0.5 rounded hover:bg-foreground/5 text-foreground-muted hover:text-foreground transition-colors cursor-pointer"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Textarea row */}
                    <div className="flex items-start gap-2">
                        <UserAvatar
                            firstName={currentUser?.firstName}
                            lastName={currentUser?.lastName}
                            avatar={currentUser?.avatar}
                            size="xs"
                            className="mt-0.5 shrink-0"
                        />

                        <textarea
                            ref={textareaRef}
                            value={content}
                            onChange={(e) => handleContentChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder || t('writeComment')}
                            rows={compact ? 1 : 2}
                            className={cn(
                                'w-full bg-transparent text-foreground placeholder:text-foreground-subtle/50',
                                'resize-none leading-relaxed',
                                '!outline-none !ring-0 !ring-offset-0 !shadow-none',
                                'focus:!outline-none focus:!ring-0 focus:!ring-offset-0 focus:!shadow-none',
                                'focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 focus-visible:!shadow-none',
                                compact ? 'text-xs min-h-[20px]' : 'text-sm min-h-[36px]',
                            )}
                        />
                    </div>

                    {/* Pending attachments */}
                    {pendingAttachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2 pt-1.5 border-t border-border/30">
                            {pendingAttachments.map((att, idx) => (
                                <div
                                    key={`${att.s3Key}-${idx}`}
                                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-foreground/5 border border-border/40 text-[10px] text-foreground-muted max-w-[200px] group/att"
                                >
                                    <FileIcon className="h-3 w-3 shrink-0 text-foreground-subtle" />
                                    <span className="truncate">{att.fileName}</span>
                                    <span className="text-foreground-subtle shrink-0">({formatFileSize(att.fileSize)})</span>
                                    <button
                                        type="button"
                                        onClick={() => removeAttachment(idx)}
                                        className="ml-auto p-0.5 rounded hover:bg-foreground/10 text-foreground-subtle hover:text-foreground transition-colors cursor-pointer shrink-0"
                                    >
                                        <X className="h-2.5 w-2.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Toolbar row */}
                    <div className={cn(
                        "flex items-center justify-between mt-2 pt-1.5 border-t border-border/30",
                        pendingAttachments.length > 0 && "mt-1.5 pt-1.5 border-t-0",
                    )}>
                        <div className="flex items-center gap-0.5">
                            {/* Type selector */}
                            {showTypeSelector &&
                                typeOptions.map((opt) => {
                                    const Icon = opt.icon;
                                    const isActive = commentType === opt.value;
                                    return (
                                        <Tooltip key={opt.value}>
                                            <TooltipTrigger asChild>
                                                <button
                                                    type="button"
                                                    onClick={() => setCommentType(opt.value)}
                                                    className={cn(
                                                        'h-7 w-7 flex items-center justify-center rounded-md transition-all cursor-pointer',
                                                        isActive
                                                            ? opt.activeColor
                                                            : 'hover:bg-foreground/5 text-foreground-subtle hover:text-foreground-muted',
                                                    )}
                                                >
                                                    <Icon className="h-3.5 w-3.5" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-xs">
                                                {opt.label}
                                            </TooltipContent>
                                        </Tooltip>
                                    );
                                })}

                            {/* Mention button */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const textarea = textareaRef.current;
                                            if (!textarea) return;
                                            textarea.focus();
                                            const pos = textarea.selectionStart;
                                            const before = content.substring(0, pos);
                                            const after = content.substring(pos);
                                            const newContent = before + '@' + after;
                                            setContent(newContent);
                                            setTimeout(() => {
                                                const newPos = pos + 1;
                                                textarea.setSelectionRange(newPos, newPos);
                                                setShowMentions(true);
                                                setMentionQuery('');
                                                setMentionIndex(0);
                                            }, 0);
                                        }}
                                        className="h-7 w-7 flex items-center justify-center rounded-md transition-all cursor-pointer hover:bg-foreground/5 text-foreground-subtle hover:text-foreground-muted"
                                    >
                                        <AtSign className="h-3.5 w-3.5" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                    {t('mentionSuggestion')}
                                </TooltipContent>
                            </Tooltip>

                            {/* Emoji picker button */}
                            <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <PopoverTrigger asChild>
                                            <button
                                                type="button"
                                                className={cn(
                                                    'h-7 w-7 flex items-center justify-center rounded-md transition-all cursor-pointer',
                                                    showEmojiPicker
                                                        ? 'bg-foreground/5 text-foreground-muted'
                                                        : 'hover:bg-foreground/5 text-foreground-subtle hover:text-foreground-muted',
                                                )}
                                            >
                                                <Smile className="h-3.5 w-3.5" />
                                            </button>
                                        </PopoverTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs">
                                        {t('emoji')}
                                    </TooltipContent>
                                </Tooltip>
                                <PopoverContent
                                    side="top"
                                    align="start"
                                    className="w-auto p-0 border-none shadow-xl rounded-xl"
                                    onOpenAutoFocus={(e) => e.preventDefault()}
                                    onCloseAutoFocus={(e) => e.preventDefault()}
                                >
                                    <Picker
                                        data={data}
                                        onEmojiSelect={insertEmoji}
                                        theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
                                        previewPosition="none"
                                        skinTonePosition="search"
                                        maxFrequentRows={2}
                                        perLine={8}
                                        emojiSize={22}
                                        emojiButtonSize={32}
                                        locale="en"
                                    />
                                </PopoverContent>
                            </Popover>

                            {/* File attachment button */}
                            <FileUpload
                                s3Type="comment-attachment"
                                uploadPath={`comments/attachments/${projectId}`}
                                multiple
                                maxSize={10485760}
                                maxFiles={5}
                                showDropzone={false}
                                showFiles={false}
                                showInfo={false}
                                showPlaceholder={false}
                                className="w-auto inline-flex"
                                contentClassName="justify-start"
                                onUploadSuccess={handleFileUploadSuccess}
                                onUploadError={handleFileUploadError}
                            >
                                <div
                                    className={cn(
                                        'h-7 w-7 flex items-center justify-center rounded-md transition-all cursor-pointer',
                                        isUploading
                                            ? 'bg-foreground/5 text-foreground-muted'
                                            : 'hover:bg-foreground/5 text-foreground-subtle hover:text-foreground-muted',
                                    )}
                                    title={t('attachFile')}
                                >
                                    {isUploading ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Paperclip className="h-3.5 w-3.5" />
                                    )}
                                </div>
                            </FileUpload>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Keyboard hint */}
                            <span className="text-[10px] text-foreground-subtle/60 hidden sm:block select-none">
                                {typeof navigator !== 'undefined' && navigator?.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}+Enter
                            </span>

                            <Button
                                onClick={handleSubmit}
                                disabled={(!content.trim() && pendingAttachments.length === 0) || isSubmitting || isUploading}
                                size="sm"
                                className={cn(
                                    "h-7 px-3 gap-1.5 text-xs rounded-lg cursor-pointer",
                                    editingComment && "bg-amber-500 hover:bg-amber-600 text-white",
                                )}
                            >
                                {isSubmitting ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : editingComment ? (
                                    <Pencil className="h-3 w-3" />
                                ) : (
                                    <Send className="h-3 w-3" />
                                )}
                                {editingComment ? t('save') : t('send')}
                            </Button>
                        </div>
                    </div>
                </div>
            </PopoverAnchor>

            {/* Mention suggestions popover */}
            <PopoverContent
                side="top"
                align="start"
                className="w-[280px] p-0 rounded-xl shadow-xl border-border/60"
                onOpenAutoFocus={(e) => e.preventDefault()}
                onCloseAutoFocus={(e) => e.preventDefault()}
            >
                <div className="px-3 py-2 border-b border-border/40">
                    <p className="text-[11px] font-medium text-foreground-muted">
                        {t('mentionSuggestion')}
                    </p>
                </div>
                <div className="max-h-[200px] overflow-y-auto py-1">
                    {filteredMembers.length === 0 ? (
                        <div className="px-3 py-4 text-center">
                            <p className="text-xs text-foreground-muted">{t('noMembersToMention')}</p>
                        </div>
                    ) : (
                        filteredMembers.map((member, idx) => (
                            <button
                                key={member.userId}
                                onClick={() => insertMention(member)}
                                onMouseEnter={() => setMentionIndex(idx)}
                                className={cn(
                                    'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer',
                                    idx === mentionIndex
                                        ? 'bg-accent'
                                        : 'hover:bg-accent/50',
                                )}
                            >
                                <UserAvatar
                                    firstName={member.firstName}
                                    lastName={member.lastName}
                                    avatar={member.avatar}
                                    size="xs"
                                />
                                <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium text-foreground truncate block">
                                        {member.firstName} {member.lastName}
                                    </span>
                                    <span className="text-[11px] text-foreground-muted truncate block">
                                        {member.email}
                                    </span>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
});
