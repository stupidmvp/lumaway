'use client';

import { useEditorContext } from '@/contexts/EditorContext';
import { StepsSidebar } from '@/components/walkthrough-editor/StepsSidebar';
import { StepEditorPanel } from '@/components/walkthrough-editor/StepEditorPanel';
import { EmptyStepState } from '@/components/walkthrough-editor/EmptyStepState';

export default function WalkthroughStepsPage() {
    const {
        localWalkthrough,
        currentStep,
        canEdit,
        selectedStepIndex,
        stepsExpanded,
        stepTitleRef,
        sensors,
        addStep,
        updateStep,
        removeStep,
        duplicateStep,
        moveStep,
        handleDragEnd,
        setSelectedStepIndex,
        toggleStepsPanel,
        handleDuplicateCurrentStep,
        handleRemoveCurrentStep,
    } = useEditorContext();

    if (!localWalkthrough) return null;

    return (
        <div className="flex flex-1 overflow-hidden">
            <StepsSidebar
                steps={localWalkthrough.steps}
                selectedStepIndex={selectedStepIndex}
                canEdit={canEdit}
                sensors={sensors}
                isExpanded={stepsExpanded}
                onToggleExpand={toggleStepsPanel}
                onAddStep={addStep}
                onSelectStep={setSelectedStepIndex}
                onDuplicateStep={duplicateStep}
                onMoveStep={moveStep}
                onRemoveStep={removeStep}
                onDragEnd={handleDragEnd}
            />

            <main className="flex-1 overflow-y-auto bg-background min-w-0">
                <div className="max-w-4xl mx-auto px-5 py-5 min-h-full flex flex-col">
                    {currentStep ? (
                        <StepEditorPanel
                            step={currentStep}
                            stepIndex={selectedStepIndex}
                            totalSteps={localWalkthrough.steps.length}
                            projectId={localWalkthrough.projectId}
                            walkthroughId={localWalkthrough.id}
                            canEdit={canEdit}
                            stepTitleRef={stepTitleRef}
                            onUpdateStep={updateStep}
                            onMoveStep={moveStep}
                            onDuplicateStep={handleDuplicateCurrentStep}
                            onRemoveStep={handleRemoveCurrentStep}
                        />
                    ) : (
                        <EmptyStepState
                            canEdit={canEdit}
                            onAddStep={addStep}
                        />
                    )}
                </div>
            </main>
        </div>
    );
}

