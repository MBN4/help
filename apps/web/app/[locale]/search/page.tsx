import type { Metadata } from 'next';
import {
  businessSearchQuerySchema,
  type BusinessSearchQuery,
} from '@buisnez/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getCity, searchBusinesses } from '@/lib/api';
import { DEFAULT_CITY_SLUG } from '@/lib/constants';
import { buildMetadata } from '@/lib/seo/metadata';
import { Link } from '@/i18n/navigation';
import { SearchBar } from '@/components/search/search-bar';
import { FilterPanel } from '@/components/search/filter-panel';
import { MobileFilterSheet } from '@/components/search/mobile-filter-sheet';
import { SortSelect } from '@/components/search/sort-select';
import { UseMyLocationButton } from '@/components/search/use-my-location-button';
import { SearchMapToggle } from '@/components/search/search-map-toggle';
import { BusinessCard } from '@/components/business/business-card';
import { Button } from '@/components/ui/button';
import { TrackEvent } from '@/components/analytics/track-event';

// Always server-rendered per request — filters/sort live in the URL and must never serve a stale cached variant.
export const dynamic = 'force-dynamic';

const LAHORE_FALLBACK_CENTER = { lat: 31.5204, lng: 74.3587 };

async function resolveMapCenter(
  query: BusinessSearchQuery,
): Promise<{ lat: number; lng: number }> {
  if (query.lat !== undefined && query.lng !== undefined) {
    return { lat: query.lat, lng: query.lng };
  }
  try {
    const { data: city } = await getCity(query.city ?? DEFAULT_CITY_SLUG);
    return city.centroid ?? LAHORE_FALLBACK_CENTER;
  } catch {
    return LAHORE_FALLBACK_CENTER;
  }
}

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'search' });
  return buildMetadata({
    title: t('metaTitle'),
    description: t('metaDescription'),
    path: '/search',
    locale,
  });
}

export default async function SearchPage({
  params,
  searchParams: searchParamsPromise,
}: PageProps): Promise<React.ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);

  const rawParams = await searchParamsPromise;
  const flatParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawParams)) {
    const first = firstValue(value);
    if (first !== undefined) {
      flatParams[key] = first;
    }
  }

  const parsed = businessSearchQuerySchema.safeParse(flatParams);
  const query = parsed.success
    ? parsed.data
    : businessSearchQuerySchema.parse({});

  const t = await getTranslations('search');
  let searchResult: Awaited<ReturnType<typeof searchBusinesses>>;
  try {
    searchResult = await searchBusinesses(query);
  } catch (error) {
    // No graceful empty-state here — a failed search request is unexpected (network/API outage), so let it
    // propagate to this route segment's error.tsx boundary instead of rendering a misleading "no results" page.
    throw error;
  }
  const { data: businesses, meta } = searchResult;

  const mapCenter = await resolveMapCenter(query);

  const totalPages = meta
    ? Math.max(1, Math.ceil(meta.total / meta.perPage))
    : 1;

  return (
    <div className="container space-y-6 py-6">
      <TrackEvent
        event="search performed"
        properties={{
          query: query.q ?? null,
          city: query.city ?? null,
          category: query.category ?? null,
          resultsCount: meta?.total ?? businesses.length,
        }}
      />
      <SearchBar />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <FilterPanel />
        </aside>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">{t('title')}</h1>
              <p className="text-sm text-muted-foreground">
                {t('resultsCount', { count: meta?.total ?? businesses.length })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <UseMyLocationButton />
              <SortSelect hasLocation={query.lat !== undefined} />
            </div>
          </div>

          <div className="lg:hidden">
            <MobileFilterSheet />
          </div>

          <SearchMapToggle businesses={businesses} center={mapCenter} />

          {businesses.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              {t('noResults')}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {businesses.map((business) => (
                <BusinessCard key={business.id} business={business} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <nav
              className="flex items-center justify-center gap-2 pt-4"
              aria-label={t('paginationLabel')}
            >
              {query.page > 1 && (
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={`/search?${new URLSearchParams({ ...flatParams, page: String(query.page - 1) }).toString()}`}
                  >
                    ←
                  </Link>
                </Button>
              )}
              <span className="text-sm text-muted-foreground">
                {query.page} / {totalPages}
              </span>
              {query.page < totalPages && (
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={`/search?${new URLSearchParams({ ...flatParams, page: String(query.page + 1) }).toString()}`}
                  >
                    →
                  </Link>
                </Button>
              )}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
