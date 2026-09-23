'use client';

import * as React from 'react';

declare global {
  interface Window {
    google?: typeof google;
  }
}

const SCRIPT_ID = 'google-maps-js-api';

type ScriptStatus = 'idle' | 'loading' | 'ready' | 'error';

let sharedStatus: ScriptStatus = 'idle';
const listeners = new Set<(status: ScriptStatus) => void>();

function setStatus(status: ScriptStatus): void {
  sharedStatus = status;
  listeners.forEach((listener) => listener(status));
}

function loadScript(apiKey: string): void {
  if (document.getElementById(SCRIPT_ID)) {
    return;
  }
  setStatus('loading');
  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async`;
  script.async = true;
  script.onload = () => setStatus('ready');
  script.onerror = () => setStatus('error');
  document.head.appendChild(script);
}

/** Lazily injects the Google Maps JS API script, shared across every MapView mounted on the page. */
export function useGoogleMapsScript(apiKey: string | undefined): ScriptStatus {
  const [status, setLocalStatus] = React.useState<ScriptStatus>(
    apiKey ? sharedStatus : 'error',
  );

  React.useEffect(() => {
    if (!apiKey) {
      return;
    }
    listeners.add(setLocalStatus);
    if (window.google?.maps) {
      setStatus('ready');
    } else if (sharedStatus === 'idle') {
      loadScript(apiKey);
    }
    return () => {
      listeners.delete(setLocalStatus);
    };
  }, [apiKey]);

  return status;
}
