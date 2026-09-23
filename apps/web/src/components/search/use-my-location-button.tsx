'use client';

import * as React from 'react';
import { LocateFixed } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { getCity } from '@/lib/api';
import {
  DEFAULT_CITY_SLUG,
  DEFAULT_SEARCH_RADIUS_METERS,
} from '@/lib/constants';
import { withUpdatedParams } from '@/lib/utils/search-params';
import { Button } from '@/components/ui/button';

export function UseMyLocationButton(): React.ReactElement {
  const t = useTranslations('search');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, setPending] = React.useState(false);
  const [denied, setDenied] = React.useState(false);

  function goToCoords(lat: number, lng: number): void {
    router.push(
      `/search?${withUpdatedParams(searchParams, {
        lat: String(lat),
        lng: String(lng),
        radius:
          searchParams.get('radius') ?? String(DEFAULT_SEARCH_RADIUS_METERS),
      })}`,
    );
  }

  async function fallbackToLahore(): Promise<void> {
    setDenied(true);
    try {
      const { data: city } = await getCity(DEFAULT_CITY_SLUG);
      if (city.centroid) {
        goToCoords(city.centroid.lat, city.centroid.lng);
      }
    } finally {
      setPending(false);
    }
  }

  function handleClick(): void {
    if (!('geolocation' in navigator)) {
      void fallbackToLahore();
      return;
    }
    setPending(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPending(false);
        goToCoords(position.coords.latitude, position.coords.longitude);
      },
      () => {
        void fallbackToLahore();
      },
      { timeout: 8000 },
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={pending}
      >
        <LocateFixed className="h-4 w-4" aria-hidden="true" />
        {t('useMyLocation')}
      </Button>
      {denied && (
        <p className="text-xs text-muted-foreground">{t('locationDenied')}</p>
      )}
    </div>
  );
}
