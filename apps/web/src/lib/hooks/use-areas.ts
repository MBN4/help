'use client';

import { useQuery } from '@tanstack/react-query';
import { getAreas } from '@/lib/api';

export function useAreas(city: string | undefined) {
  return useQuery({
    queryKey: ['areas', city ?? null],
    queryFn: async () => (await getAreas(city as string)).data,
    enabled: Boolean(city),
    staleTime: 10 * 60_000,
  });
}
