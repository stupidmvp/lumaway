'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    useWalkthrough,
    useUpdateWalkthrough,
    useWalkthroughVersions,
    useUpdateVersion,
    usePermissions,
    useProjectSettingsPermissions,
    useGenerateWalkthroughGifs,
    Step,
    Walkthrough,
    useCurrentUser,
    DEFAULT_PREFERENCES,
    LumensService,
} from '@luma/infra';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import {
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';

const ROLE_ICONS_KEYS = ['owner', 'admin', 'editor', 'viewer'] as const;

export function useEditorState(id: string) {
    const t = useTranslations('Editor');
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();

    // TanStack Query Hooks
    const { data: walkthroughData, isLoading, isError } = useWalkthrough(id);
    const { data: versionsData } = useWalkthroughVersions(id);
    const versions = versionsData?.pages.flatMap((page) => page.data) ?? [];
    const updateMutation = useUpdateWalkthrough();
    const updateVersionMutation = useUpdateVersion();
    const generateGifsMutation = useGenerateWalkthroughGifs();
    const permissions = usePermissions();

    // Project settings permissions (publish, delete, comment, etc.)
    const projectSettingsPerms = useProjectSettingsPermissions(walkthroughData?.projectId);

    // Permission checks
    const canEdit = walkthroughData
        ? permissions.can('update', 'walkthroughs', { projectId: walkthroughData.projectId })
        : false;

    // canDeleteWalkthrough: project settings allow deletion for this user role
    const canDeleteWalkthrough = projectSettingsPerms.canDeleteWalkthrough;

    // canComment: project settings allow commenting for this user role
    const canComment = projectSettingsPerms.canComment;

    // Resolve effective role (needed for approval checks)
    const projectId = walkthroughData?.projectId;
    const directProjectRole = projectId ? permissions.getProjectRole(projectId) : null;
    const isOwnerOrAdmin = permissions.isSuperAdmin() || (projectId ? permissions.isOrgAdminOrOwner() : false) || directProjectRole === 'owner';
    const effectiveRole = permissions.isSuperAdmin()
        ? 'owner'
        : (directProjectRole ?? (permissions.isOrgAdminOrOwner() ? 'admin' : null));

    // Approval flags
    const latestVersion = versions[0]; // Assuming versions are sorted by date desc
    const approvalRequired = projectSettingsPerms.settings?.approvalRequired ?? false;
    const versionStatus = latestVersion?.status ?? 'draft';

    const canRequestApproval = canEdit && versionStatus === 'draft' && approvalRequired;
    const canApprove = isOwnerOrAdmin && versionStatus === 'pending_approval';
    const canReject = canApprove;

    // canPublish updated: user can edit AND (no approval required OR version is approved)
    const canPublish = canEdit && (!approvalRequired || versionStatus === 'approved' || versionStatus === 'published');

    const reviewerUserIds = projectSettingsPerms.settings?.reviewerUserIds ?? [];
    const approvals = (latestVersion as any)?.approvals || [];
    const minApprovals = projectSettingsPerms.settings?.minApprovals ?? 1;
    const approvalsCount = approvals.length;

    // User Preferences
    const { data: currentUser } = useCurrentUser();
    const prefs = {
        ...DEFAULT_PREFERENCES,
        ...(currentUser?.preferences ?? {}),
    };

    // Local state
    const [localWalkthrough, setLocalWalkthrough] = useState<Walkthrough | null>(null);
    const [selectedStepIndex, setSelectedStepIndex] = useState<number>(-1);
    const [showVersionHistory, setShowVersionHistory] = useState(false);
    const [stepsExpanded, setStepsExpanded] = useState(true);
    const [mediaLibraryExpanded, setMediaLibraryExpanded] = useState(false);
    const hasInitializedExpanded = useRef(false);
    const hasInitializedMediaLibrary = useRef(false);
    const stepTitleRef = useRef<HTMLInputElement>(null);
    const shouldFocusTitleRef = useRef(false);
    const localWalkthroughRef = useRef<Walkthrough | null>(null);

    // DND Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Sync local state when data loads
    useEffect(() => {
        if (walkthroughData) {
            if (!localWalkthrough) {
                setLocalWalkthrough(walkthroughData);
                if (walkthroughData.steps.length > 0 && selectedStepIndex === -1) {
                    setSelectedStepIndex(0);
                }
            } else {
                // Background merge for media fields (GIFs/Covers) 
                // that might have been updated by background processes
                const hasMediaUpdates = walkthroughData.steps.some((s, i) => {
                    const localStep = localWalkthrough.steps[i];
                    return (s.gifUrl && !localStep?.gifUrl) || (s.coverUrl && !localStep?.coverUrl);
                });

                if (hasMediaUpdates) {
                    const mergedSteps = localWalkthrough.steps.map((ls, i) => {
                        const serverStep = walkthroughData.steps[i];
                        if (!serverStep) return ls;
                        return {
                            ...ls,
                            gifUrl: ls.gifUrl || serverStep.gifUrl,
                            coverUrl: ls.coverUrl || serverStep.coverUrl
                        };
                    });
                    setLocalWalkthrough(prev => prev ? { ...prev, steps: mergedSteps } : null);
                }
            }
            localWalkthroughRef.current = walkthroughData;
        }
    }, [walkthroughData]);

    useEffect(() => {
        localWalkthroughRef.current = localWalkthrough;
    }, [localWalkthrough]);

    // Initialize sidebar state based on preferences
    useEffect(() => {
        if (currentUser && !hasInitializedExpanded.current) {
            setStepsExpanded(prefs.editorSidebarOpen);
            hasInitializedExpanded.current = true;
        }
    }, [currentUser, prefs.editorSidebarOpen]);

    // Initialize media library state based on whether a source is linked
    useEffect(() => {
        if (walkthroughData && !hasInitializedMediaLibrary.current) {
            // If no source is linked, open the library by default
            if (!walkthroughData.observerSessionId) {
                setMediaLibraryExpanded(true);
            }
            hasInitializedMediaLibrary.current = true;
        }
    }, [walkthroughData]);

    // Auto-select step from URL param (e.g. navigating from a comment step badge)
    useEffect(() => {
        const stepId = searchParams.get('stepId');
        if (!stepId || !walkthroughData) return;
        const idx = walkthroughData.steps.findIndex((s) => s.id === stepId);
        if (idx >= 0) {
            setSelectedStepIndex(idx);
        }
    }, [searchParams, walkthroughData]);

    // Auto-focus title when selecting a new step or when explicitly requested (duplicate)
    useEffect(() => {
        if (selectedStepIndex >= 0 && localWalkthrough) {
            const step = localWalkthrough.steps[selectedStepIndex];
            if (step && (!step.title || shouldFocusTitleRef.current)) {
                shouldFocusTitleRef.current = false;
                setTimeout(() => {
                    stepTitleRef.current?.focus();
                    stepTitleRef.current?.select();
                }, 80);
            }
        }
    }, [selectedStepIndex, localWalkthrough]);

    const currentStep = selectedStepIndex >= 0 ? localWalkthrough?.steps[selectedStepIndex] ?? null : null;

    // --- Handlers ---

    const handleSave = useCallback(async () => {
        const walkthrough = localWalkthroughRef.current;
        if (!walkthrough) return;

        const emptySteps = walkthrough.steps.filter(s => !s.title.trim());
        if (emptySteps.length > 0) {
            const idx = walkthrough.steps.findIndex(s => !s.title.trim());
            setSelectedStepIndex(idx);
            setTimeout(() => stepTitleRef.current?.focus(), 50);
            toast.error(t('stepTitleRequired'));
            return;
        }

        try {
            await updateMutation.mutateAsync({
                id: walkthrough.id,
                data: {
                    title: walkthrough.title,
                    icon: walkthrough.icon || null,
                    coverUrl: walkthrough.coverUrl || null,
                    observerSessionId: walkthrough.observerSessionId || null,
                    description: walkthrough.description || null,
                    steps: walkthrough.steps,
                    tags: walkthrough.tags,
                    isPublished: walkthrough.isPublished,
                    parentId: walkthrough.parentId || null,
                    previousWalkthroughId: walkthrough.previousWalkthroughId || null,
                    nextWalkthroughId: walkthrough.nextWalkthroughId || null,
                }
            });
            toast.success(t('walkthroughSaved'));
        } catch (e) {
            console.error(e);
            toast.error(t('walkthroughSaveFailed'));
        }
    }, [updateMutation, t]);

    const addStep = useCallback((atIndex?: number) => {
        if (!localWalkthrough) return;
        const newStep: Step = {
            id: Math.random().toString(36).substr(2, 9),
            title: '',
            description: '',
            placement: prefs.defaultStepPlacement as any,
            target: ''
        };
        
        const newSteps = [...localWalkthrough.steps];
        const insertIndex = typeof atIndex === 'number' ? atIndex : newSteps.length;
        newSteps.splice(insertIndex, 0, newStep);
        
        setLocalWalkthrough({ ...localWalkthrough, steps: newSteps });
        setSelectedStepIndex(insertIndex);
    }, [localWalkthrough, prefs.defaultStepPlacement]);

    const updateStep = useCallback((index: number, field: keyof Step, value: any) => {
        if (!localWalkthrough) return;
        const newSteps = [...localWalkthrough.steps];
        newSteps[index] = { ...newSteps[index], [field]: value } as Step;
        setLocalWalkthrough({ ...localWalkthrough, steps: newSteps });
    }, [localWalkthrough]);

    const removeStep = useCallback((index: number) => {
        if (!localWalkthrough || index < 0) return;
        const newSteps = localWalkthrough.steps.filter((_, i) => i !== index);
        setLocalWalkthrough({ ...localWalkthrough, steps: newSteps });

        if (newSteps.length === 0) {
            setSelectedStepIndex(-1);
        } else {
            const nextIndex = Math.min(index, newSteps.length - 1);
            setSelectedStepIndex(nextIndex);
        }
    }, [localWalkthrough]);

    const duplicateStep = useCallback((index: number) => {
        if (!localWalkthrough || index < 0) return;
        const stepToClone = localWalkthrough.steps[index];
        if (!stepToClone) return;
        const newStep: Step = {
            id: Math.random().toString(36).substr(2, 9),
            title: `${stepToClone.title} (${t('copy')})`,
            description: stepToClone.description,
            target: stepToClone.target,
            placement: stepToClone.placement
        };
        const newSteps = [...localWalkthrough.steps];
        newSteps.splice(index + 1, 0, newStep);
        setLocalWalkthrough({ ...localWalkthrough, steps: newSteps });
        shouldFocusTitleRef.current = true;
        setSelectedStepIndex(index + 1);
    }, [localWalkthrough, t]);

    const moveStep = useCallback((index: number, direction: 'up' | 'down') => {
        if (!localWalkthrough) return;
        const newSteps = [...localWalkthrough.steps];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= newSteps.length) return;

        const temp = newSteps[index];
        const targetStep = newSteps[newIndex];
        if (!temp || !targetStep) return;

        newSteps[index] = targetStep;
        newSteps[newIndex] = temp;

        setLocalWalkthrough({ ...localWalkthrough, steps: newSteps });
        setSelectedStepIndex(newIndex);
    }, [localWalkthrough]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        if (!localWalkthrough) return;
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = localWalkthrough.steps.findIndex(s => s.id === active.id);
            const newIndex = localWalkthrough.steps.findIndex(s => s.id === over.id);

            const newSteps = arrayMove(localWalkthrough.steps, oldIndex, newIndex);
            setLocalWalkthrough({ ...localWalkthrough, steps: newSteps });
            setSelectedStepIndex(newIndex);
        }
    }, [localWalkthrough]);

    const requestApproval = useCallback(async () => {
        if (!latestVersion) return;
        try {
            await updateVersionMutation.mutateAsync({
                versionId: latestVersion.id,
                data: { status: 'pending_approval' }
            });
            toast.success(t('submittingForReview'));
        } catch (e) {
            toast.error(t('walkthroughSaveFailed'));
        }
    }, [latestVersion, updateVersionMutation, t]);

    const approveVersion = useCallback(async () => {
        if (!latestVersion) return;
        try {
            await updateVersionMutation.mutateAsync({
                versionId: latestVersion.id,
                data: { status: 'approved' }
            });
            toast.success(t('statusApproved'));
        } catch (e) {
            toast.error(t('walkthroughSaveFailed'));
        }
    }, [latestVersion, updateVersionMutation, t]);

    const rejectVersion = useCallback(async (reason?: string) => {
        if (!latestVersion) return;
        try {
            await updateVersionMutation.mutateAsync({
                versionId: latestVersion.id,
                data: { status: 'rejected', rejectionReason: reason }
            });
            toast.success(t('statusRejected'));
        } catch (e) {
            toast.error(t('walkthroughSaveFailed'));
        }
    }, [latestVersion, updateVersionMutation, t]);

    const togglePublish = useCallback(async () => {
        if (!localWalkthrough) return;
        const newIsPublished = !localWalkthrough.isPublished;
        setLocalWalkthrough({ ...localWalkthrough, isPublished: newIsPublished });
        try {
            await updateMutation.mutateAsync({
                id: localWalkthrough.id,
                data: { isPublished: newIsPublished }
            });
            toast.success(newIsPublished ? t('markedAsPublished') : t('markedAsDraftNotice'));
        } catch (e) {
            setLocalWalkthrough({ ...localWalkthrough, isPublished: !newIsPublished });
            toast.error(t('walkthroughSaveFailed'));
        }
    }, [localWalkthrough, updateMutation, t]);

    const syncRecordingTimings = useCallback(async () => {
        if (!id || !localWalkthrough?.observerSessionId) return;

        try {
            // Fetch session candidates (events) to get timing data
            const review = await LumensService.getReview(localWalkthrough.observerSessionId);
            const candidates = review.stepCandidates || [];

            if (candidates.length === 0) {
                toast.error('No events found in this recording to map.');
                return;
            }

            // Map candidates to steps based on index
            const newSteps = localWalkthrough.steps.map((step, i) => {
                const candidate = candidates[i];
                if (!candidate) return step;

                // Use the same timing logic as the generation service
                const transcriptWindowStartMs = candidate.metadata?.interactionMap?.transcriptWindowStartMs ?? candidate.timestampMs;
                const transcriptWindowEndMs = candidate.metadata?.interactionMap?.transcriptWindowEndMs ?? (candidate.timestampMs + 4000);

                return {
                    ...step,
                    startMs: transcriptWindowStartMs,
                    endMs: transcriptWindowEndMs,
                    target: step.target || candidate.targetSelector || undefined
                };
            });

            // Update state AND ref immediately so the subsequent save reads fresh data
            const updated = { ...localWalkthrough, steps: newSteps };
            setLocalWalkthrough(updated);
            localWalkthroughRef.current = updated;

            toast.success('Steps synchronized with recording timeline.');

            // Save immediately — ref is already up-to-date, no setTimeout needed
            await handleSave();
        } catch (e) {
            console.error('Sync failed:', e);
            toast.error('Failed to sync timings from recording.');
        }
    }, [id, localWalkthrough, handleSave]);

    const generateGifs = useCallback(async () => {
        if (!id) return;
        const walkthrough = localWalkthroughRef.current;
        if (!walkthrough?.observerSessionId) {
            toast.error(t('noVideoSourceLinked') || 'No video source linked. Please link a recording first.');
            return;
        }
        try {
            const result = await generateGifsMutation.mutateAsync(id);

            // Immediately update local state with the returned gifUrls —
            // don't wait for the background query refetch, which might miss the merge.
            if (result?.results?.length > 0) {
                setLocalWalkthrough(prev => {
                    if (!prev) return null;
                    const updatedSteps = prev.steps.map((step: Step) => {
                        const gifResult = result.results.find((r: any) => r.stepId === step.id);
                        return gifResult ? { ...step, gifUrl: gifResult.gifUrl } : step;
                    });
                    const updated = { ...prev, steps: updatedSteps };
                    localWalkthroughRef.current = updated;
                    return updated;
                });
            }

            // Also invalidate query so the server state is eventually synced
            queryClient.invalidateQueries({ queryKey: ['walkthrough', id] });
            toast.success(t('gifsGenerated') || `Generated ${result?.generatedCount ?? 0} step GIF(s) successfully`);
        } catch (e) {
            console.error('GIF generation failed:', e);
            toast.error(t('gifsGenerationFailed') || 'Failed to generate step GIFs');
        }
    }, [id, generateGifsMutation, queryClient, t]);

    const updateLocalWalkthrough = useCallback((updates: Partial<Walkthrough>) => {
        if (!localWalkthrough) return;
        const updated = { ...localWalkthrough, ...updates };
        setLocalWalkthrough(updated);
        // Sync the ref immediately so consumers like handleSave don't read stale values
        // before the next React render cycle updates it via the useEffect below
        localWalkthroughRef.current = updated;
    }, [localWalkthrough]);

    const toggleMediaLibrary = useCallback(() => {
        setMediaLibraryExpanded(prev => !prev);
    }, []);

    const toggleStepsPanel = useCallback(() => {
        setStepsExpanded(prev => !prev);
    }, []);

    const openVersionHistory = useCallback(() => {
        setShowVersionHistory(true);
    }, []);

    const closeVersionHistory = useCallback(() => {
        setShowVersionHistory(false);
    }, []);

    return {
        // Data
        localWalkthrough,
        currentStep,
        versions,
        isLoading,
        isError,
        canEdit,
        canPublish,
        canDeleteWalkthrough,
        canComment,
        effectiveRole,
        selectedStepIndex,
        showVersionHistory,
        stepsExpanded,
        mediaLibraryExpanded,
        latestVersion,
        approvalRequired,
        versionStatus,
        approvalsCount,
        minApprovals,
        reviewerUserIds,
        approvals,
        canRequestApproval,
        canApprove,
        canReject,
        isGeneratingGifs: generateGifsMutation.isPending,
        isPending: updateMutation.isPending,
        stepTitleRef,
        sensors,

        // Actions
        handleSave,
        addStep,
        updateStep,
        removeStep,
        duplicateStep,
        moveStep,
        handleDragEnd,
        togglePublish,
        requestApproval,
        approveVersion,
        rejectVersion,
        generateGifs,
        updateLocalWalkthrough,
        setSelectedStepIndex,
        toggleStepsPanel,
        toggleMediaLibrary,
        syncRecordingTimings,
        openVersionHistory,
        closeVersionHistory,
    };
}

