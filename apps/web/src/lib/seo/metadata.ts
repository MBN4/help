import type { Metadata } from 'next';
import { routing } from '@/i18n/routing';

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export interface BuildMetadataParams {
  title: string;
  description: string;
  /** Locale-neutral path, e.g. "/", "/lahore", "/lahore/restaurants", "/business/some-slug". */
  path: string;
  locale: string;
  image?: string;
}

function localizedUrl(path: string, locale: string): string {
  const prefix = locale === routing.defaultLocale ? '' : `/${locale}`;
  const suffix = path === '/' ? '' : path;
  return `${SITE_URL}${prefix}${suffix}`;
}

/** Builds title/description/canonical/hreflang/OpenGraph consistently across public pages. */
export function buildMetadata({
  title,
  description,
  path,
  locale,
  image,
}: BuildMetadataParams): Metadata {
  const languages: Record<string, string> = {};
  for (const supported of routing.locales) {
    languages[supported] = localizedUrl(path, supported);
  }

  const canonical = localizedUrl(path, locale);

  return {
    title,
    description,
    alternates: { canonical, languages },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'Buisnez',
      locale,
      type: 'website',
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}
