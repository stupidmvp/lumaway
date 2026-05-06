'use client';

import { useEditorContext } from '@/contexts/EditorContext';
import { StepsSidebar } from '@/components/walkthrough-editor/StepsSidebar';
import { StepEditorPanel } from '@/components/walkthrough-editor/StepEditorPanel';
import { EmptyStepState } from '@/components/walkthrough-editor/EmptyStepState';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';

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
        <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
            <ResizablePanel 
                defaultSize={25} 
                minSize={15} 
                maxSize={40} 
                className="border-r border-border bg-background transition-all duration-300"
            >
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
            </ResizablePanel>

            <ResizableHandle withHandle className="bg-border" />

            <ResizablePanel defaultSize={75} className="bg-background relative min-w-0">
                <main className="absolute inset-0 overflow-y-auto">
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
                                steps={localWalkthrough.steps}
                            />
                        ) : (
                            <EmptyStepState
                                canEdit={canEdit}
                                onAddStep={addStep}
                            />
                        )}
                    </div>
                </main>
            </ResizablePanel>
        </ResizablePanelGroup>
    );
}

