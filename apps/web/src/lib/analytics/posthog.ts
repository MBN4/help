'use client';

import posthog from 'posthog-js';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let initialized = false;

/**
 * Lazily initializes posthog-js exactly once. Completely inert (no network calls, no console noise) when
 * NEXT_PUBLIC_POSTHOG_KEY is unset — same "stub until credentialed" bar as every other optional integration
 * in this repo (OAuth's STUB_DISABLED, the Google Maps key-gated fallback).
 */
export function initPostHog(): void {
  if (initialized || !POSTHOG_KEY || typeof window === 'undefined') {
    return;
  }
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false, // captured manually on route change, see posthog-provider.tsx
    person_profiles: 'identified_only',
  });
  initialized = true;
}

/** No-ops when PostHog was never initialized (no key configured). */
export function trackEvent(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (!initialized) {
    return;
  }
  posthog.capture(event, properties);
}

export function capturePageview(url: string): void {
  if (!initialized) {
    return;
  }
  posthog.capture('$pageview', { $current_url: url });
}
