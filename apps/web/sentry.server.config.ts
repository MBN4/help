// Sentry server (Node runtime) init. Inert when NEXT_PUBLIC_SENTRY_DSN is unset — see sentry.client.config.ts.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
  });
}
