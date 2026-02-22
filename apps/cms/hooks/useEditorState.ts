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
    Step,
    Walkthrough,
    useCurrentUser,
    DEFAULT_PREFERENCES,
} from '@luma/infra';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
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

    // TanStack Query Hooks
    const { data: walkthroughData, isLoading, isError } = useWalkthrough(id);
    const { data: versionsData } = useWalkthroughVersions(id);
    const versions = versionsData?.pages.flatMap((page) => page.data) ?? [];
    const updateMutation = useUpdateWalkthrough();
    const updateVersionMutation = useUpdateVersion();
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
    const hasInitializedExpanded = useRef(false);
    const stepTitleRef = useRef<HTMLInputElement>(null);
    const shouldFocusTitleRef = useRef(false);

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
            setLocalWalkthrough(walkthroughData);
            if (walkthroughData.steps.length > 0 && selectedStepIndex === -1) {
                setSelectedStepIndex(0);
            }
        }
    }, [walkthroughData]);

    // Initialize sidebar state based on preferences
    useEffect(() => {
        if (currentUser && !hasInitializedExpanded.current) {
            setStepsExpanded(prefs.editorSidebarOpen);
            hasInitializedExpanded.current = true;
        }
    }, [currentUser, prefs.editorSidebarOpen]);

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
        if (!localWalkthrough) return;

        const emptySteps = localWalkthrough.steps.filter(s => !s.title.trim());
        if (emptySteps.length > 0) {
            const idx = localWalkthrough.steps.findIndex(s => !s.title.trim());
            setSelectedStepIndex(idx);
            setTimeout(() => stepTitleRef.current?.focus(), 50);
            toast.error(t('stepTitleRequired'));
            return;
        }

        try {
            await updateMutation.mutateAsync({
                id: localWalkthrough.id,
                data: {
                    title: localWalkthrough.title,
                    description: localWalkthrough.description || null,
                    steps: localWalkthrough.steps,
                    tags: localWalkthrough.tags,
                    isPublished: localWalkthrough.isPublished,
                    parentId: localWalkthrough.parentId || null,
                    previousWalkthroughId: localWalkthrough.previousWalkthroughId || null,
                    nextWalkthroughId: localWalkthrough.nextWalkthroughId || null,
                }
            });
            toast.success(t('walkthroughSaved'));
        } catch (e) {
            console.error(e);
            toast.error(t('walkthroughSaveFailed'));
        }
    }, [localWalkthrough, updateMutation, t]);

    const addStep = useCallback(() => {
        if (!localWalkthrough) return;
        const newStep: Step = {
            id: Math.random().toString(36).substr(2, 9),
            title: '',
            description: '',
            placement: prefs.defaultStepPlacement as any,
            target: ''
        };
        const newSteps = [...localWalkthrough.steps, newStep];
        setLocalWalkthrough({ ...localWalkthrough, steps: newSteps });
        setSelectedStepIndex(newSteps.length - 1);
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

    const updateLocalWalkthrough = useCallback((updates: Partial<Walkthrough>) => {
        if (!localWalkthrough) return;
        setLocalWalkthrough({ ...localWalkthrough, ...updates });
    }, [localWalkthrough]);

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
        updateLocalWalkthrough,
        setSelectedStepIndex,
        toggleStepsPanel,
        openVersionHistory,
        closeVersionHistory,
    };
}

