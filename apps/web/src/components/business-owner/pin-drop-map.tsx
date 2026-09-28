'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useGoogleMapsScript } from '@/components/map/use-google-maps-script';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export interface PinDropMapProps {
  value: { lat: number; lng: number };
  onChange: (value: { lat: number; lng: number }) => void;
  className?: string;
}

/**
 * Draggable-pin location editor. Falls back to plain numeric lat/lng inputs when the Google Maps script
 * isn't ready (e.g. no NEXT_PUBLIC_GOOGLE_MAPS_API_KEY configured) so the editor stays usable either way.
 */
export function PinDropMap({
  value,
  onChange,
  className,
}: PinDropMapProps): React.ReactElement {
  const t = useTranslations('businessOwner');
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<google.maps.Map | null>(null);
  const markerRef = React.useRef<google.maps.Marker | null>(null);
  const status = useGoogleMapsScript(GOOGLE_MAPS_API_KEY);

  // Kept in refs so the map-init effect only depends on `status`, not `value`/`onChange` (re-initializing
  // the map on every coordinate change would fight the marker drag and reset the viewport).
  const initialValueRef = React.useRef(value);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  React.useEffect(() => {
    if (status !== 'ready' || !containerRef.current) {
      return;
    }
    if (!mapRef.current) {
      const initialValue = initialValueRef.current;
      mapRef.current = new google.maps.Map(containerRef.current, {
        center: initialValue,
        zoom: 15,
        disableDefaultUI: true,
        zoomControl: true,
      });
      markerRef.current = new google.maps.Marker({
        position: initialValue,
        map: mapRef.current,
        draggable: true,
      });
      markerRef.current.addListener('dragend', () => {
        const position = markerRef.current?.getPosition();
        if (position) {
          onChangeRef.current({ lat: position.lat(), lng: position.lng() });
        }
      });
    }
  }, [status]);

  React.useEffect(() => {
    if (status === 'ready' && markerRef.current && mapRef.current) {
      markerRef.current.setPosition(value);
      mapRef.current.setCenter(value);
    }
  }, [status, value]);

  // Keyboard fallback for the mouse-drag-only marker: with the map focused, arrow keys nudge the pin by a
  // small lat/lng step (~11m at this latitude). This doesn't fully replicate free-form dragging, but gives
  // keyboard users a way to place the pin without a mouse. See docs/PROGRESS.md Phase 9 a11y notes.
  const NUDGE_STEP = 0.0001;
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (status !== 'ready') {
      return;
    }
    let next: { lat: number; lng: number } | null = null;
    switch (event.key) {
      case 'ArrowUp':
        next = { lat: value.lat + NUDGE_STEP, lng: value.lng };
        break;
      case 'ArrowDown':
        next = { lat: value.lat - NUDGE_STEP, lng: value.lng };
        break;
      case 'ArrowLeft':
        next = { lat: value.lat, lng: value.lng - NUDGE_STEP };
        break;
      case 'ArrowRight':
        next = { lat: value.lat, lng: value.lng + NUDGE_STEP };
        break;
      default:
        return;
    }
    event.preventDefault();
    onChangeRef.current(next);
  }

  if (status !== 'ready') {
    return (
      <div className={cn('grid grid-cols-2 gap-3', className)}>
        <div className="space-y-1.5">
          <Label htmlFor="location-lat">{t('location.latLabel')}</Label>
          <Input
            id="location-lat"
            type="number"
            step="0.0001"
            value={value.lat}
            onChange={(event) =>
              onChange({ ...value, lat: Number(event.target.value) })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location-lng">{t('location.lngLabel')}</Label>
          <Input
            id="location-lng"
            type="number"
            step="0.0001"
            value={value.lng}
            onChange={(event) =>
              onChange({ ...value, lng: Number(event.target.value) })
            }
          />
        </div>
        <p className="col-span-2 text-xs text-muted-foreground">
          {t('location.mapUnavailable')}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="application"
      aria-label={t('location.mapKeyboardHint')}
      onKeyDown={handleKeyDown}
      className={cn(
        'min-h-[280px] w-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    />
  );
}
