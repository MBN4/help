'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthUser } from '@buisnez/shared';
import { ApiError, getMe } from '@/lib/api';

export const SESSION_QUERY_KEY = ['session'];

export function useSession(): {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
} {
  const query = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async () => {
      try {
        return (await getMe()).data;
      } catch (error) {
        if (
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403)
        ) {
          return null;
        }
        throw error;
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isAuthenticated: Boolean(query.data),
  };
}

export function useInvalidateSession(): () => Promise<void> {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
  };
}
