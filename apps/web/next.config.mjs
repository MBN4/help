import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Built at config-build time (next.config.mjs runs in Node, so process.env is directly readable here) from
// a single `host:port` env var rather than hardcoding a port — see docs/PROGRESS.md Phase 9 notes on the
// stale-port bug this replaces. Format: "localhost:9102".
const s3PublicHost = process.env.NEXT_PUBLIC_S3_PUBLIC_HOST;
const [s3Hostname, s3Port] = s3PublicHost ? s3PublicHost.split(':') : [];

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    // Matched to this app's actual rendered image widths: BusinessCard grid images use
    // `sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 100vw"` and PhotoGallery thumbnails use
    // `sizes="(min-width: 640px) 20vw, 33vw"`, against Tailwind's sm(640)/lg(1024) breakpoints and this
    // app's `container` max-width (~1280px) — so deviceSizes covers full-viewport widths up to a wide
    // desktop, and imageSizes covers the smaller fixed-fraction crops (thumbnails, avatars).
    deviceSizes: [384, 640, 750, 828, 1080, 1280, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      ...(s3Hostname
        ? [
            {
              protocol: 'http',
              hostname: s3Hostname,
              port: s3Port ?? '',
            },
          ]
        : []),
    ],
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  disableLogger: true,
  // Source map upload needs a SENTRY_AUTH_TOKEN and a real DSN; without either this step is a no-op, so the
  // build stays green with no Sentry project configured (the "stub until credentialed" bar).
  sourcemaps: {
    disable:
      !process.env.NEXT_PUBLIC_SENTRY_DSN || !process.env.SENTRY_AUTH_TOKEN,
  },
  widenClientFileUpload: false,
  reactComponentAnnotation: { enabled: false },
});
