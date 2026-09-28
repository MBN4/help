'use client';

import * as React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { capturePageview, initPostHog } from '@/lib/analytics/posthog';

/**
 * Mounts PostHog once and captures a pageview on every route change. Renders nothing; entirely inert when
 * NEXT_PUBLIC_POSTHOG_KEY is unset (initPostHog/capturePageview both no-op in that case).
 */
export function PostHogProvider(): null {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    initPostHog();
  }, []);

  React.useEffect(() => {
    const query = searchParams.toString();
    capturePageview(query ? `${pathname}?${query}` : pathname);
  }, [pathname, searchParams]);

  return null;
}
