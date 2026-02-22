'use client';

import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { useEditorState } from '@/hooks/useEditorState';

type EditorContextValue = ReturnType<typeof useEditorState> & {
    id: string;
    handleParentChange: (value: string | null) => void;
    handlePreviousChange: (value: string | null) => void;
    handleNextChange: (value: string | null) => void;
    handleTitleChange: (title: string) => void;
    handleDescriptionChange: (description: string) => void;
    handleTagsChange: (tags: string[]) => void;
    handleDuplicateCurrentStep: () => void;
    handleRemoveCurrentStep: () => void;
    reviewerUserIds: string[];
    approvals: any[];
};

const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditorContext() {
    const ctx = useContext(EditorContext);
    if (!ctx) throw new Error('useEditorContext must be used within EditorProvider');
    return ctx;
}

interface EditorProviderProps {
    id: string;
    children: ReactNode;
}

export function EditorProvider({ id, children }: EditorProviderProps) {
    const editorState = useEditorState(id);

    const {
        updateLocalWalkthrough,
        duplicateStep,
        removeStep,
        selectedStepIndex,
    } = editorState;

    const handleParentChange = useCallback((value: string | null) => {
        updateLocalWalkthrough({ parentId: value });
    }, [updateLocalWalkthrough]);

    const handlePreviousChange = useCallback((value: string | null) => {
        updateLocalWalkthrough({ previousWalkthroughId: value });
    }, [updateLocalWalkthrough]);

    const handleNextChange = useCallback((value: string | null) => {
        updateLocalWalkthrough({ nextWalkthroughId: value });
    }, [updateLocalWalkthrough]);

    const handleTitleChange = useCallback((title: string) => {
        updateLocalWalkthrough({ title });
    }, [updateLocalWalkthrough]);

    const handleDescriptionChange = useCallback((description: string) => {
        updateLocalWalkthrough({ description });
    }, [updateLocalWalkthrough]);

    const handleTagsChange = useCallback((tags: string[]) => {
        updateLocalWalkthrough({ tags });
    }, [updateLocalWalkthrough]);

    const handleDuplicateCurrentStep = useCallback(() => {
        duplicateStep(selectedStepIndex);
    }, [duplicateStep, selectedStepIndex]);

    const handleRemoveCurrentStep = useCallback(() => {
        removeStep(selectedStepIndex);
    }, [removeStep, selectedStepIndex]);

    return (
        <EditorContext.Provider
            value={{
                id,
                ...editorState,
                handleParentChange,
                handlePreviousChange,
                handleNextChange,
                handleTitleChange,
                handleDescriptionChange,
                handleTagsChange,
                handleDuplicateCurrentStep,
                handleRemoveCurrentStep,
            }}
        >
            {children}
        </EditorContext.Provider>
    );
}

