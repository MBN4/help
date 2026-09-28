import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'http', hostname: 'localhost', port: '9000' },
      // This machine's docker-compose.yml remaps MinIO to 9102 (see docs/PROGRESS.md's Phase 5 entry) —
      // the 9000 pattern above was never updated to match, so any real (non-picsum) uploaded photo 500'd
      // on render. Found via the Phase 8 full-suite Playwright pass.
      { protocol: 'http', hostname: 'localhost', port: '9102' },
    ],
  },
};

export default withNextIntl(nextConfig);
