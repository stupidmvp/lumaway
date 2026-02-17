import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProjectFavoritesService } from '../services/project-favorites.service';

/**
 * Fetch the current user's favorite projects.
 */
export const useProjectFavorites = () => {
    return useQuery({
        queryKey: ['project-favorites'],
        queryFn: () => ProjectFavoritesService.getAll(),
    });
};

/**
 * Toggle a project's favorite status.
 * If the project is already favorited, removes it; otherwise adds it.
 */
export const useToggleProjectFavorite = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ projectId, favoriteId }: { projectId: string; favoriteId?: string }) => {
            if (favoriteId) {
                // Remove favorite
                await ProjectFavoritesService.remove(favoriteId);
                return { action: 'removed' as const, projectId };
            } else {
                // Add favorite
                const result = await ProjectFavoritesService.create(projectId);
                return { action: 'added' as const, projectId, favorite: result };
            }
        },
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['project-favorites'] }),
                queryClient.invalidateQueries({ queryKey: ['projects'] }),
            ]);
        },
    });
};

