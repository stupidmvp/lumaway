'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { useDebounce } from 'use-debounce';

interface ProjectSearchContextValue {
    search: string;
    setSearch: (value: string) => void;
    debouncedSearch: string;
}

const ProjectSearchContext = createContext<ProjectSearchContextValue>({
    search: '',
    setSearch: () => {},
    debouncedSearch: '',
});

export function ProjectSearchProvider({ children }: { children: ReactNode }) {
    const [search, setSearch] = useState('');
    const [debouncedSearch] = useDebounce(search, 300);

    return (
        <ProjectSearchContext.Provider value={{ search, setSearch, debouncedSearch }}>
            {children}
        </ProjectSearchContext.Provider>
    );
}

export function useProjectSearch() {
    return useContext(ProjectSearchContext);
}


