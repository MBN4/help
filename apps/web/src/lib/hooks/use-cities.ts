'use client';

import { useQuery } from '@tanstack/react-query';
import { getCities } from '@/lib/api';

export function useCities(province?: string) {
  return useQuery({
    queryKey: ['cities', province ?? null],
    queryFn: async () => (await getCities(province)).data,
    staleTime: 10 * 60_000,
  });
}
