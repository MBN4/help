'use client';

import { useQuery } from '@tanstack/react-query';
import { getFeatures } from '@/lib/api';

export function useFeatures() {
  return useQuery({
    queryKey: ['features'],
    queryFn: async () => (await getFeatures()).data,
    staleTime: 10 * 60_000,
  });
}
