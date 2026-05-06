'use client';

import { useEditorContext } from '@/contexts/EditorContext';
import { WalkthroughProperties } from '@/components/walkthrough-editor/WalkthroughProperties';
import { WalkthroughFlowSection } from '@/components/walkthrough-editor/WalkthroughFlowSection';
import { ActorAssignment } from '@/components/walkthrough-editor/ActorAssignment';
import { SubWalkthroughsSection } from '@/components/walkthrough-editor/SubWalkthroughsSection';
import { WalkthroughDocumentView } from '@/components/walkthrough-editor/WalkthroughDocumentView';

export default function WalkthroughGeneralPage() {
    const {
        id,
        localWalkthrough,
        canEdit,
        handleTagsChange,
        handleParentChange,
        handlePreviousChange,
        handleNextChange,
        handleTitleChange,
        handleDescriptionChange,
        addStep,
        updateStep,
        removeStep,
        handleDragEnd,
        sensors,
        selectedStepIndex,
        setSelectedStepIndex,
    } = useEditorContext();

    if (!localWalkthrough) return null;

    return (
        <main className="flex-1 overflow-y-auto bg-background min-w-0 custom-scrollbar">
            <div className="w-full px-5 sm:px-6 py-5 min-h-full flex flex-col">
                {/* Notion-style Document View */}
                {localWalkthrough.steps && localWalkthrough.steps.length > 0 && (
                    <div className="mt-4">
                        <WalkthroughDocumentView 
                            title={localWalkthrough.title}
                            description={localWalkthrough.description ?? null}
                            steps={localWalkthrough.steps} 
                            canEdit={canEdit}
                            onTitleChange={handleTitleChange}
                            onDescriptionChange={handleDescriptionChange}
                            onUpdateStep={updateStep}
                            onAddStep={addStep}
                            onRemoveStep={removeStep}
                            onDragEnd={handleDragEnd}
                            sensors={sensors}
                            selectedStepIndex={selectedStepIndex}
                            onSelectStep={setSelectedStepIndex}
                        />
                    </div>
                )}

                {/* Divider */}
                <div className="border-t border-border/40 my-8" />

                {/* Sub-walkthroughs */}
                <SubWalkthroughsSection
                    walkthroughId={id}
                    projectId={localWalkthrough.projectId}
                    canEdit={canEdit}
                />
            </div>
        </main>
    );
}

