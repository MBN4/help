'use client';

import * as React from 'react';
import { Map as MapIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { BusinessSummary } from '@buisnez/shared';
import { Button } from '@/components/ui/button';
import { businessUrl } from '@/lib/seo/json-ld';
import { useMapViewportStore } from '@/lib/stores/map-viewport-store';
import { LazyMapView } from '@/components/map/lazy-map-view';

export interface SearchMapToggleProps {
  businesses: BusinessSummary[];
  center: { lat: number; lng: number };
  /** Desktop split-view usage (search/page.tsx's sticky right column) — map always mounted, no toggle
   * button, height fills its sticky container instead of the mobile toggle's fixed min-height. */
  alwaysVisible?: boolean;
}

export function SearchMapToggle({
  businesses,
  center,
  alwaysVisible = false,
}: SearchMapToggleProps): React.ReactElement {
  const t = useTranslations('search');
  const [showMap, setShowMap] = React.useState(false);
  const { viewport, setViewport } = useMapViewportStore();

  React.useEffect(() => {
    setViewport({ ...center, zoom: 12 });
  }, [center, setViewport]);

  const markers = businesses.flatMap((business) => {
    if (!business.location) {
      return [];
    }
    return [
      {
        id: business.id,
        lat: business.location.lat,
        lng: business.location.lng,
        title: business.name,
        href: businessUrl(business.slug),
      },
    ];
  });

  if (alwaysVisible) {
    return (
      <LazyMapView
        center={viewport}
        zoom={viewport.zoom}
        markers={markers}
        className="h-[calc(100vh-8rem)] min-h-[420px]"
      />
    );
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setShowMap((value) => !value)}
      >
        <MapIcon className="h-4 w-4" aria-hidden="true" />
        {showMap ? t('hideMap') : t('showMap')}
      </Button>
      {showMap && (
        <LazyMapView center={viewport} zoom={viewport.zoom} markers={markers} />
      )}
    </div>
  );
}
