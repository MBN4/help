'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import type { PinDropMapProps } from './pin-drop-map';

export const LazyPinDropMap = dynamic<PinDropMapProps>(
  () => import('./pin-drop-map').then((mod) => mod.PinDropMap),
  {
    ssr: false,
    loading: () => <Skeleton className="min-h-[280px] w-full" />,
  },
);
