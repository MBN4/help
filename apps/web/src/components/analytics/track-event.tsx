'use client';

import * as React from 'react';
import { trackEvent } from '@/lib/analytics/posthog';

/**
 * Fires a single PostHog event on mount (and whenever `event`/`properties` change). Used to record a funnel
 * event from a Server Component page without converting the whole page to a Client Component. No-ops when
 * PostHog isn't initialized (no NEXT_PUBLIC_POSTHOG_KEY configured).
 */
export function TrackEvent({
  event,
  properties,
}: {
  event: string;
  properties?: Record<string, unknown>;
}): null {
  const propertiesKey = JSON.stringify(properties);
  React.useEffect(() => {
    trackEvent(event, properties);
    // propertiesKey (a stable serialization of `properties`) drives this effect instead of `properties`
    // itself, since a fresh object literal is passed on every render.
  }, [event, propertiesKey]);

  return null;
}
