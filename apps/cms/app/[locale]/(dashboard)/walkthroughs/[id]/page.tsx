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
        addStep,
        updateStep,
        handleDragEnd,
        sensors,
    } = useEditorContext();

    if (!localWalkthrough) return null;

    return (
        <main className="flex-1 overflow-y-auto bg-background min-w-0">
            <div className="w-full px-5 sm:px-6 py-5 min-h-full flex flex-col">
                {/* Properties — actionable fields only */}
                <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5">
                    <WalkthroughProperties
                        tags={localWalkthrough.tags ?? []}
                        canEdit={canEdit}
                        onTagsChange={handleTagsChange}
                    />

                    <ActorAssignment
                        walkthroughId={id}
                        projectId={localWalkthrough.projectId}
                        canEdit={canEdit}
                    />

                    <WalkthroughFlowSection
                        walkthroughId={id}
                        projectId={localWalkthrough.projectId}
                        parentId={localWalkthrough.parentId}
                        previousWalkthroughId={localWalkthrough.previousWalkthroughId}
                        nextWalkthroughId={localWalkthrough.nextWalkthroughId}
                        onParentChange={handleParentChange}
                        onPreviousChange={handlePreviousChange}
                        onNextChange={handleNextChange}
                    />
                </div>

                {/* Notion-style Document View */}
                {localWalkthrough.steps && localWalkthrough.steps.length > 0 && (
                    <div className="mt-4">
                        <WalkthroughDocumentView 
                            steps={localWalkthrough.steps} 
                            canEdit={canEdit}
                            onUpdateStep={updateStep}
                            onAddStep={addStep}
                            onDragEnd={handleDragEnd}
                            sensors={sensors}
                        />
                    </div>
                )}

                {/* Divider */}
                <div className="border-t border-border/40 my-3" />

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

