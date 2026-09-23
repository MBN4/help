'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import type { MapViewProps } from './map-view';

export const LazyMapView = dynamic<MapViewProps>(
  () => import('./map-view').then((mod) => mod.MapView),
  {
    ssr: false,
    loading: () => <Skeleton className="min-h-[180px] w-full" />,
  },
);
