'use client';

import { useQuery } from '@tanstack/react-query';
import { getCategoryTree } from '@/lib/api';

export function useCategoryTree() {
  return useQuery({
    queryKey: ['category-tree'],
    queryFn: async () => (await getCategoryTree()).data,
    staleTime: 10 * 60_000,
  });
}
