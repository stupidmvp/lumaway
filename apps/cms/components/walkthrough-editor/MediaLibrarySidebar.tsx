'use client';

import React from 'react';
import { useLumens } from '@luma/infra';
import {
    Video,
    Clock,
    CheckCircle2,
    Play,
    MoreVertical,
    Search,
    FileVideo,
    Link2,
    Film,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LumenPreviewModal } from './LumenPreviewModal';

interface MediaLibrarySidebarProps {
    projectId: string;
    linkedSessionId?: string | null;
    onSelectSession: (id: string) => void;
    onGenerateGifs?: (sessionId: string) => void;
}

export function MediaLibrarySidebar({
    projectId,
    linkedSessionId,
    onSelectSession,
    onGenerateGifs,
}: MediaLibrarySidebarProps) {
    const t = useTranslations('ProjectLumens');
    const { data, isLoading } = useLumens(projectId, 50);
    const lumens = Array.isArray(data) ? data : (data?.data || []);

    const [searchQuery, setSearchQuery] = React.useState('');
    const [previewLumenId, setPreviewLumenId] = React.useState<string | null>(null);
    const [previewLumenTitle, setPreviewLumenTitle] = React.useState<string | undefined>(undefined);

    const filteredLumens = lumens.filter((lumen: any) =>
        (lumen.intent || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <aside className="h-full flex flex-col bg-background-secondary/10 border-r border-border/40 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border/40 bg-background-secondary/20">
            <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-lg bg-accent-blue/10 flex items-center justify-center flex-shrink-0">
                        <Video className="h-4 w-4 text-accent-blue" />
                    </div>
                    <h2 className="text-[13px] font-bold uppercase tracking-wider truncate">
                        Media Library
                    </h2>
                </div>
                <Badge variant="secondary" className="h-5 px-2 text-[10px] font-bold bg-background-secondary text-foreground-muted flex-shrink-0">
                    {lumens.length} Lumens
                </Badge>
            </div>

                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted/40" />
                    <Input 
                        placeholder="Search recordings..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-8 text-[12px] bg-background-secondary/30 border-border/40 focus:bg-background transition-colors placeholder:text-foreground-muted/30"
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-3 space-y-3">
                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-24 w-full rounded-lg" />
                                <Skeleton className="h-3 w-3/4 rounded" />
                            </div>
                        ))
                    ) : filteredLumens.length === 0 ? (
                        <div className="py-12 text-center space-y-2">
                            <div className="h-10 w-10 rounded-full bg-background-secondary flex items-center justify-center mx-auto opacity-40">
                                <FileVideo className="h-5 w-5 text-foreground-muted" />
                            </div>
                            <p className="text-[12px] text-foreground-muted font-medium">No recordings found</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
                            {filteredLumens.map((lumen: any) => {
                                const isLinked = linkedSessionId === lumen.id;

                                return (
                                    <div
                                        key={lumen.id}
                                        className={cn(
                                            "group relative flex flex-col rounded-xl overflow-hidden border transition-all duration-200",
                                            isLinked
                                                ? "bg-accent-blue/5 border-accent-blue/40 ring-1 ring-accent-blue/20 shadow-md"
                                                : "bg-background border-border/50 hover:border-border/80 hover:bg-background-secondary/20 hover:shadow-sm"
                                        )}
                                    >
                                        {/* Thumbnail Area — click opens preview */}
                                        <div
                                            className="aspect-video relative overflow-hidden bg-background-secondary/50 cursor-pointer"
                                            onClick={() => {
                                                setPreviewLumenId(lumen.id);
                                                setPreviewLumenTitle(lumen.intent || undefined);
                                            }}
                                        >
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <FileVideo className={cn(
                                                    "h-8 w-8 transition-colors",
                                                    isLinked ? "text-accent-blue/40" : "text-foreground-muted/20 group-hover:text-foreground-muted/40"
                                                )} />
                                            </div>

                                            {/* Duration Overlay */}
                                            {lumen.videoDurationMs && (
                                                <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-[10px] font-bold text-white px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm backdrop-blur-[2px]">
                                                    {Math.round(lumen.videoDurationMs / 1000)}s
                                                </div>
                                            )}

                                            {/* Linked badge */}
                                            {isLinked && (
                                                <div className="absolute top-0 right-0 p-1.5">
                                                    <div className="bg-accent-blue text-white rounded-full p-0.5 shadow-sm">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Hover play overlay */}
                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <div className="h-8 w-8 rounded-full bg-white/90 flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                                                    <Play className="h-3.5 w-3.5 text-accent-blue fill-current ml-0.5" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Content Area */}
                                        <div className="p-2.5 space-y-1.5">
                                            <div className="flex items-start justify-between gap-1.5">
                                                <h3 className={cn(
                                                    "text-[12px] font-bold leading-tight line-clamp-2 transition-colors",
                                                    isLinked ? "text-accent-blue" : "text-foreground"
                                                )}>
                                                    {lumen.intent || 'Untitled Recording'}
                                                </h3>

                                                {/* Actions dropdown */}
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="shrink-0 flex h-5 w-5 items-center justify-center rounded text-foreground-muted/30 hover:text-foreground-muted hover:bg-background-secondary transition-colors opacity-0 group-hover:opacity-100"
                                                        >
                                                            <MoreVertical className="h-3.5 w-3.5" />
                                                        </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48 rounded-lg shadow-xl border-border/40">
                                                        <DropdownMenuItem
                                                            onClick={() => onSelectSession(lumen.id)}
                                                            className="gap-2 text-xs cursor-pointer m-0.5 rounded"
                                                        >
                                                            <Link2 className="h-3.5 w-3.5 opacity-60" />
                                                            {isLinked ? 'Linked' : 'Link to walkthrough'}
                                                        </DropdownMenuItem>
                                                        {onGenerateGifs && (
                                                            <DropdownMenuItem
                                                                onClick={() => onGenerateGifs(lumen.id)}
                                                                className="gap-2 text-xs cursor-pointer m-0.5 rounded"
                                                            >
                                                                <Film className="h-3.5 w-3.5 opacity-60" />
                                                                Generate GIFs
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>

                                            <div className="flex items-center gap-3 text-[10px] text-foreground-muted/60 font-medium">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3 opacity-60" />
                                                    {new Date(lumen.createdAt).toLocaleDateString(undefined, {
                                                        month: 'short',
                                                        day: 'numeric',
                                                    })}
                                                </span>
                                                <span className="uppercase tracking-wider">
                                                    {lumen.captureSource}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-border/40 bg-background-secondary/10">
                <p className="text-[10px] text-center text-foreground-muted/30 font-medium">
                    Click thumbnail to preview · hover for actions
                </p>
            </div>

            {/* Preview modal */}
            <LumenPreviewModal
                open={Boolean(previewLumenId)}
                onOpenChange={(open) => { if (!open) setPreviewLumenId(null); }}
                lumenId={previewLumenId}
                lumenTitle={previewLumenTitle}
            />
        </aside>
    );
}
