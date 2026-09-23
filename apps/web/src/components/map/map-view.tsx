'use client';

import * as React from 'react';
import { MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';
import { useGoogleMapsScript } from './use-google-maps-script';

export interface MapMarkerInput {
  id: string;
  lat: number;
  lng: number;
  title: string;
  href?: string;
}

export interface MapViewProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers: MapMarkerInput[];
  className?: string;
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export function MapView({
  center,
  zoom = 13,
  markers,
  className,
}: MapViewProps): React.ReactElement {
  const t = useTranslations('business');
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<google.maps.Map | null>(null);
  const status = useGoogleMapsScript(GOOGLE_MAPS_API_KEY);

  React.useEffect(() => {
    if (status !== 'ready' || !containerRef.current) {
      return;
    }
    if (!mapRef.current) {
      mapRef.current = new google.maps.Map(containerRef.current, {
        center,
        zoom,
        disableDefaultUI: true,
        zoomControl: true,
      });
    } else {
      mapRef.current.setCenter(center);
      mapRef.current.setZoom(zoom);
    }

    const markerInstances = markers.map((marker) => {
      const instance = new google.maps.Marker({
        position: { lat: marker.lat, lng: marker.lng },
        map: mapRef.current ?? undefined,
        title: marker.title,
      });
      if (marker.href) {
        instance.addListener('click', () =>
          window.open(marker.href, '_blank', 'noopener,noreferrer'),
        );
      }
      return instance;
    });

    return () => {
      markerInstances.forEach((instance) => instance.setMap(null));
    };
  }, [status, center, zoom, markers]);

  if (status !== 'ready') {
    return (
      <div
        className={cn(
          'flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted p-6 text-center',
          className,
        )}
      >
        <MapPin className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t('mapUnavailable')}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('min-h-[220px] w-full rounded-lg', className)}
    />
  );
}
