'use client';

import * as React from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '@/lib/utils/cn';

export interface MapMarkerInput {
  id: string;
  lat: number;
  lng: number;
  title: string;
  href?: string;
  /** Shown inside the pin (e.g. the result's list number, like Yelp); a plain pin when omitted. */
  label?: string;
}

export interface MapViewProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers: MapMarkerInput[];
  className?: string;
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

/** Red Yelp-style pin as a Leaflet divIcon, so no marker image assets are needed. */
function pinIcon(label?: string): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [30, 38],
    iconAnchor: [15, 38],
    popupAnchor: [0, -34],
    html: `<span style="position:relative;display:block;width:30px;height:38px">
      <svg viewBox="0 0 30 38" width="30" height="38" aria-hidden="true"><path d="M15 0C6.7 0 0 6.6 0 14.8 0 25.4 15 38 15 38s15-12.6 15-23.2C30 6.6 23.3 0 15 0z" fill="#f43939" stroke="#fff" stroke-width="2"/></svg>
      <span style="position:absolute;inset:0 0 10px 0;display:flex;align-items:center;justify-content:center;color:#fff;font:700 12px/1 Inter,system-ui,sans-serif">${
        label
          ? label.replace(/[<>&"']/g, '')
          : '<span style="width:9px;height:9px;border-radius:9999px;background:#fff"></span>'
      }</span></span>`,
  });
}

function popupContent(marker: MapMarkerInput): HTMLElement {
  const wrapper = document.createElement('div');
  const title = document.createElement(marker.href ? 'a' : 'strong');
  title.textContent = marker.title;
  if (marker.href && title instanceof HTMLAnchorElement) {
    title.href = marker.href;
    title.style.fontWeight = '600';
  }
  wrapper.appendChild(title);
  return wrapper;
}

export function MapView({
  center,
  zoom = 13,
  markers,
  className,
}: MapViewProps): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<L.Map | null>(null);
  const layerRef = React.useRef<L.LayerGroup | null>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const map = L.map(container, { zoomControl: true, scrollWheelZoom: false });
    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);
    map.setView([center.lat, center.lng], zoom);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // The container is sized by CSS (sticky column, flex, tabs) — keep Leaflet in sync with it.
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // The map is created once; center/zoom/markers are applied by the effect below.
  }, []);

  React.useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) {
      return;
    }
    layer.clearLayers();
    markers.forEach((marker) => {
      L.marker([marker.lat, marker.lng], {
        icon: pinIcon(marker.label),
        title: marker.title,
        alt: marker.title,
      })
        .bindPopup(popupContent(marker))
        .addTo(layer);
    });

    if (markers.length > 1) {
      map.fitBounds(
        L.latLngBounds(markers.map((marker) => [marker.lat, marker.lng])),
        { padding: [40, 40], maxZoom: 15 },
      );
    } else {
      map.setView([center.lat, center.lng], zoom);
    }
  }, [center, zoom, markers]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'z-0 min-h-[220px] w-full overflow-hidden rounded-lg border border-border',
        className,
      )}
    />
  );
}
