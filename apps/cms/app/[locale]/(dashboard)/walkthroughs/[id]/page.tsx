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
        handleIconChange,
        handleCoverUrlChange,
        addStep,
        updateStep,
        removeStep,
        handleDragEnd,
        sensors,
        selectedStepIndex,
        setSelectedStepIndex,
        generateGifs,
        isGeneratingGifs,
        handleObserverSessionChange,
        toggleMediaLibrary,
        syncRecordingTimings,
    } = useEditorContext();

    if (!localWalkthrough) return null;

    return (
        <div className="w-full min-h-full flex flex-col">
            {/* Notion-style Document View */}
            <WalkthroughDocumentView 
                projectId={localWalkthrough.projectId}
                walkthroughId={id}
                title={localWalkthrough.title}
                icon={localWalkthrough.icon ?? null}
                coverUrl={localWalkthrough.coverUrl ?? null}
                observerSessionId={localWalkthrough.observerSessionId ?? null}
                description={localWalkthrough.description ?? null}
                steps={localWalkthrough.steps} 
                canEdit={canEdit}
                onTitleChange={handleTitleChange}
                onIconChange={handleIconChange}
                onCoverChange={handleCoverUrlChange}
                onObserverSessionChange={handleObserverSessionChange}
                onDescriptionChange={handleDescriptionChange}
                onUpdateStep={updateStep}
                onAddStep={addStep}
                onRemoveStep={removeStep}
                onDragEnd={handleDragEnd}
                sensors={sensors}
                selectedStepIndex={selectedStepIndex}
                onSelectStep={setSelectedStepIndex}
                onGenerateGifs={generateGifs}
                isGeneratingGifs={isGeneratingGifs}
                onSyncTimings={syncRecordingTimings}
                toggleMediaLibrary={toggleMediaLibrary}
            />

            {/* Additional content below document */}
            <div className="max-w-[800px] mx-auto w-full px-12 pb-24">
                {/* Divider */}
                <div className="border-t border-border/40 my-8" />

                {/* Sub-walkthroughs */}
                <SubWalkthroughsSection
                    walkthroughId={id}
                    projectId={localWalkthrough.projectId}
                    canEdit={canEdit}
                />
            </div>
        </div>
    );
}

