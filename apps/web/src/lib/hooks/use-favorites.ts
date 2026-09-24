'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyFavoriteIds } from '@/lib/api';
import { useSession } from './use-session';

export const FAVORITE_IDS_QUERY_KEY = ['favorite-ids'];

/**
 * Business detail/card pages are server-rendered (ISR) with no per-user data, so `FavoriteButton` can't be
 * told a business's saved state as a prop — it has to hydrate itself. One shared query per page (React
 * Query dedupes by key) backs every `FavoriteButton` instance via `GET /favorites/mine/ids`.
 */
export function useFavoriteIds(): {
  favoriteIds: Set<string>;
  isLoading: boolean;
} {
  const { isAuthenticated } = useSession();
  const query = useQuery({
    queryKey: FAVORITE_IDS_QUERY_KEY,
    queryFn: async () => (await getMyFavoriteIds()).data,
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  return {
    favoriteIds: new Set(query.data ?? []),
    isLoading: isAuthenticated && query.isLoading,
  };
}

export function useInvalidateFavoriteIds(): () => Promise<void> {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: FAVORITE_IDS_QUERY_KEY });
  };
}
