'use client';

import React, { useState, useEffect } from 'react';
import { Trash2, Search, SlidersHorizontal, Video, Image as ImageIcon, FileVideo, Clock, Play, CheckCircle2, Link2, Film, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLumens } from '@luma/infra';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { LumenPreviewModal } from './LumenPreviewModal';
import { FileUpload, FileWithProgress } from '@/components/ui/file-upload';
import { ENV } from '@/lib/env';

import { WalkthroughProperties } from './WalkthroughProperties';
import { ActorAssignment } from './ActorAssignment';
import { WalkthroughFlowSection } from './WalkthroughFlowSection';
import { StepPropertiesSidebar } from './StepPropertiesSidebar';

export type EditorSidebarTab = 'properties' | 'lumens' | 'media';

interface EditorSidebarProps {
    activeTab: EditorSidebarTab;
    projectId: string;
    walkthroughId: string;
    id: string;
    localWalkthrough: any;
    canEdit: boolean;

    handleTagsChange: (tags: string[]) => void;
    handleParentChange: (id: string | null) => void;
    handlePreviousChange: (id: string | null) => void;
    handleNextChange: (id: string | null) => void;

    currentStep: any;
    selectedStepIndex: number;
    updateStep: (index: number, step: any) => void;

    linkedSessionId?: string | null;
    onSelectSession: (id: string) => void;
    onGenerateGifs?: (sessionId: string) => void;
}

interface MediaAsset {
    id: string;
    url: string;
    name: string;
    createdAt: string;
}

const GALLERY_KEY = (pid: string) => `luma-media-${pid}`;

function useProjectMedia(projectId: string) {
    const [media, setMedia] = useState<MediaAsset[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(GALLERY_KEY(projectId));
            if (stored) {
                setMedia(JSON.parse(stored) as MediaAsset[]);
            }
        } catch (err) {
            console.error('Failed to load media gallery:', err);
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    const addMedia = (url: string, name: string) => {
        const asset: MediaAsset = {
            id: `${Date.now()}`,
            url,
            name,
            createdAt: new Date().toISOString(),
        };
        const updated = [asset, ...media];
        setMedia(updated);
        try {
            localStorage.setItem(GALLERY_KEY(projectId), JSON.stringify(updated));
        } catch (err) {
            console.error('Failed to save media:', err);
        }
    };

    const removeMedia = (id: string) => {
        const updated = media.filter((m) => m.id !== id);
        setMedia(updated);
        try {
            localStorage.setItem(GALLERY_KEY(projectId), JSON.stringify(updated));
        } catch (err) {
            console.error('Failed to remove media:', err);
        }
    };

    return { media, isLoading, addMedia, removeMedia };
}

export function EditorSidebar({
    activeTab,
    projectId,
    walkthroughId,
    id,
    localWalkthrough,
    canEdit,
    handleTagsChange,
    handleParentChange,
    handlePreviousChange,
    handleNextChange,
    currentStep,
    selectedStepIndex,
    updateStep,
    linkedSessionId,
    onSelectSession,
    onGenerateGifs,
}: EditorSidebarProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [previewLumenId, setPreviewLumenId] = useState<string | null>(null);
    const [previewLumenTitle, setPreviewLumenTitle] = useState<string | undefined>();

    const { data, isLoading } = useLumens(projectId, 50);
    const lumens = Array.isArray(data) ? data : (data?.data || []);
    const filteredLumens = lumens.filter((lumen: any) =>
        (lumen.intent || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const { media, isLoading: mediaLoading, addMedia, removeMedia } = useProjectMedia(projectId);

    return (
        <aside className="h-full flex flex-col bg-background overflow-hidden border-r border-border/40">
            {/* Content panel */}
            <div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar">
                {/* PROPERTIES TAB */}
                {activeTab === 'properties' && (
                    <div className="divide-y divide-border/40">
                        {/* Document Settings Section */}
                        <section className="p-6 space-y-6">
                            <div className="flex items-center gap-2 text-foreground/80">
                                <SlidersHorizontal className="h-3.5 w-3.5 text-accent-blue" />
                                <h3 className="text-[11px] font-bold uppercase tracking-[0.08em]">
                                    Document Settings
                                </h3>
                            </div>
                            <div className="space-y-5 px-1">
                                <WalkthroughProperties
                                    tags={localWalkthrough.tags ?? []}
                                    canEdit={canEdit}
                                    onTagsChange={handleTagsChange}
                                />
                                <ActorAssignment
                                    walkthroughId={id}
                                    projectId={projectId}
                                    canEdit={canEdit}
                                />
                            </div>
                        </section>

                        {/* Workflow & Logic Section */}
                        <section className="p-6 space-y-6">
                            <div className="flex items-center gap-2 text-foreground/80">
                                <FileVideo className="h-3.5 w-3.5 text-foreground-muted" />
                                <h3 className="text-[11px] font-bold uppercase tracking-[0.08em]">
                                    Workflow & Logic
                                </h3>
                            </div>
                            <div className="space-y-5 px-1">
                                <WalkthroughFlowSection
                                    walkthroughId={id}
                                    projectId={projectId}
                                    parentId={localWalkthrough.parentId}
                                    previousWalkthroughId={localWalkthrough.previousWalkthroughId}
                                    nextWalkthroughId={localWalkthrough.nextWalkthroughId}
                                    onParentChange={handleParentChange}
                                    onPreviousChange={handlePreviousChange}
                                    onNextChange={handleNextChange}
                                />
                            </div>
                        </section>

                        {/* Step Properties Section */}
                        {selectedStepIndex >= 0 && (
                            <>
                                <div className="border-b border-border/40" />
                                <section className="p-6 space-y-4">
                                    <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-foreground/60">
                                        Step {selectedStepIndex + 1}
                                    </div>
                                </section>
                                <StepPropertiesSidebar
                                    step={currentStep}
                                    stepIndex={selectedStepIndex}
                                    projectId={projectId}
                                    canEdit={canEdit}
                                    onUpdateStep={updateStep}
                                />
                            </>
                        )}
                    </div>
                )}

                {/* LUMENS TAB */}
                {activeTab === 'lumens' && (
                    <div className="p-3 space-y-3 flex flex-col h-full">
                        {/* Search bar */}
                        <div className="relative flex-shrink-0">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted/40" />
                            <Input
                                placeholder="Search recordings…"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8 h-8 text-[12px] bg-background-secondary/30 border-border/40 focus:bg-background transition-colors placeholder:text-foreground-muted/30"
                            />
                        </div>

                        {/* Lumens list */}
                        {isLoading ? (
                            <div className="space-y-3">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="space-y-2">
                                        <Skeleton className="h-24 w-full rounded-lg" />
                                        <Skeleton className="h-3 w-3/4 rounded" />
                                    </div>
                                ))}
                            </div>
                        ) : filteredLumens.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="text-center space-y-2 opacity-40">
                                    <FileVideo className="h-8 w-8 mx-auto" />
                                    <p className="text-[12px] text-foreground-muted font-medium">
                                        {searchQuery ? 'No recordings found' : 'No recordings'}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                {filteredLumens.map((lumen: any) => {
                                    const isLinked = linkedSessionId === lumen.id;
                                    return (
                                        <div
                                            key={lumen.id}
                                            className={cn(
                                                'group relative flex flex-col rounded-lg overflow-hidden border transition-all cursor-pointer',
                                                isLinked
                                                    ? 'bg-accent-blue/5 border-accent-blue/40 ring-1 ring-accent-blue/20'
                                                    : 'bg-background border-border/50 hover:border-border/80 hover:bg-background-secondary/20'
                                            )}
                                            onClick={() => {
                                                setPreviewLumenId(lumen.id);
                                                setPreviewLumenTitle(lumen.intent || undefined);
                                            }}
                                        >
                                            <div className="aspect-video relative overflow-hidden bg-background-secondary/50">
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <FileVideo className={cn(
                                                        'h-6 w-6 transition-colors',
                                                        isLinked ? 'text-accent-blue/40' : 'text-foreground-muted/20 group-hover:text-foreground-muted/40'
                                                    )} />
                                                </div>

                                                {lumen.videoDurationMs && (
                                                    <div className="absolute bottom-1 right-1 bg-black/70 text-[9px] font-bold text-white px-1 py-0.5 rounded flex items-center gap-1 shadow-sm">
                                                        {Math.round(lumen.videoDurationMs / 1000)}s
                                                    </div>
                                                )}

                                                {isLinked && (
                                                    <div className="absolute top-0 right-0 p-1">
                                                        <CheckCircle2 className="h-3 w-3 text-accent-blue" />
                                                    </div>
                                                )}

                                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <Play className="h-3 w-3 text-white fill-white" />
                                                </div>
                                            </div>

                                            <div className="p-2 space-y-1">
                                                <h3 className={cn(
                                                    'text-[11px] font-bold line-clamp-2',
                                                    isLinked ? 'text-accent-blue' : 'text-foreground'
                                                )}>
                                                    {lumen.intent || 'Untitled'}
                                                </h3>
                                                <div className="text-[9px] text-foreground-muted/60 flex items-center gap-1">
                                                    <Clock className="h-2.5 w-2.5" />
                                                    {new Date(lumen.createdAt).toLocaleDateString(undefined, {
                                                        month: 'short',
                                                        day: 'numeric',
                                                    })}
                                                </div>
                                            </div>

                                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="p-1 bg-background-secondary rounded hover:bg-background-secondary/80"
                                                        >
                                                            <MoreVertical className="h-3 w-3 text-foreground-muted" />
                                                        </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-40">
                                                        <DropdownMenuItem
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onSelectSession(lumen.id);
                                                            }}
                                                            className="gap-2 text-xs"
                                                        >
                                                            <Link2 className="h-3 w-3" />
                                                            {isLinked ? 'Linked' : 'Link'}
                                                        </DropdownMenuItem>
                                                        {onGenerateGifs && (
                                                            <DropdownMenuItem
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onGenerateGifs(lumen.id);
                                                                }}
                                                                className="gap-2 text-xs"
                                                            >
                                                                <Film className="h-3 w-3" />
                                                                Generate GIFs
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* MEDIA TAB */}
                {activeTab === 'media' && (
                    <div className="p-3 space-y-3 flex flex-col h-full">
                        {/* Upload button */}
                        <div className="flex-shrink-0">
                            <FileUpload
                                allowedTypes={['image/*']}
                                s3Type="project-media"
                                uploadPath={`projects/${projectId}/media`}
                                onUploadSuccess={(files: FileWithProgress[]) => {
                                    if (files[0]?.fileUrl) {
                                        addMedia(files[0].fileUrl, files[0].file.name);
                                    }
                                }}
                                showDropzone={false}
                                showFiles={false}
                                placeholder="Upload"
                                fileUploadButtonVariant="outline"
                                fileUploadButtonClassName="w-full text-xs h-8"
                                icon={<ImageIcon className="h-3.5 w-3.5" />}
                            />
                        </div>

                        {/* Media grid */}
                        {mediaLoading ? (
                            <div className="grid grid-cols-3 gap-2">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <Skeleton key={i} className="aspect-square rounded-lg" />
                                ))}
                            </div>
                        ) : media.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="text-center space-y-2 opacity-40">
                                    <ImageIcon className="h-8 w-8 mx-auto" />
                                    <p className="text-[12px] text-foreground-muted font-medium">
                                        No images yet
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {media.map((asset) => (
                                    <div
                                        key={asset.id}
                                        className="group relative aspect-square rounded-lg overflow-hidden bg-background-secondary/50 border border-border/30 hover:border-border/60 transition-all cursor-pointer"
                                    >
                                        <img
                                            src={
                                                asset.url.startsWith('http')
                                                    ? asset.url
                                                    : `${ENV.S3_URL_BASE}/${asset.url}`
                                            }
                                            alt={asset.name}
                                            className="w-full h-full object-cover hover:scale-105 transition-transform"
                                            onClick={() => {
                                                // Copy to clipboard or trigger copy action
                                                navigator.clipboard.writeText(asset.url);
                                            }}
                                        />
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeMedia(asset.id);
                                            }}
                                            className="absolute top-0.5 right-0.5 p-1 bg-black/60 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                                        >
                                            <Trash2 className="h-3 w-3 text-white" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Preview modal */}
            <LumenPreviewModal
                open={Boolean(previewLumenId)}
                onOpenChange={(open) => {
                    if (!open) setPreviewLumenId(null);
                }}
                lumenId={previewLumenId}
                lumenTitle={previewLumenTitle}
            />
        </aside>
    );
}
