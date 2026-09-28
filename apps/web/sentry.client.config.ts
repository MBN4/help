// Sentry browser init. Stays completely inert — no network calls, no console noise — whenever
// NEXT_PUBLIC_SENTRY_DSN is unset, matching the "stub until credentialed" bar every optional
// integration in this repo follows (OAuth's STUB_DISABLED, the Google Maps key-gated fallback).
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    // Session replay is off by default; enable via NEXT_PUBLIC_SENTRY_DSN + explicit opt-in later if needed.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}
