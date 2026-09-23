import { create } from 'zustand';

export interface MapViewport {
  lat: number;
  lng: number;
  zoom: number;
}

interface MapViewportState {
  viewport: MapViewport;
  setViewport: (viewport: MapViewport) => void;
}

const LAHORE_FALLBACK_VIEWPORT: MapViewport = {
  lat: 31.5204,
  lng: 74.3587,
  zoom: 12,
};

export const useMapViewportStore = create<MapViewportState>((set) => ({
  viewport: LAHORE_FALLBACK_VIEWPORT,
  setViewport: (viewport) => set({ viewport }),
}));
