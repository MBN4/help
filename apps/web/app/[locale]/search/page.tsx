import type { Metadata } from 'next';
import {
  businessSearchQuerySchema,
  type BusinessSearchQuery,
} from '@buisnez/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getCity, searchBusinesses } from '@/lib/api';
import { DEFAULT_CITY_SLUG } from '@/lib/constants';
import { buildMetadata } from '@/lib/seo/metadata';
import { SearchBar } from '@/components/search/search-bar';
import { FilterPanel } from '@/components/search/filter-panel';
import { MobileFilterSheet } from '@/components/search/mobile-filter-sheet';
import { SortSelect } from '@/components/search/sort-select';
import { UseMyLocationButton } from '@/components/search/use-my-location-button';
import { SearchMapToggle } from '@/components/search/search-map-toggle';
import { BusinessListItem } from '@/components/business/business-list-item';
import { Pagination } from '@/components/search/pagination';
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

  const pageHref = (page: number): string =>
    `/search?${new URLSearchParams({ ...flatParams, page: String(page) }).toString()}`;

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
      <div className="md:hidden">
        <SearchBar />
      </div>

      {/* Yelp's signature split view — docs/17-design-overhaul.md section "Search results page": filters
          (left rail / mobile sheet, unchanged component) | results list | a sticky map column at lg+.
          Same `SearchMapToggle` component and data as before this pass; below `lg` it still behaves as a
          toggle (see that component's own comment for why marker hover-highlighting wasn't added — no
          Maps key exists in this environment to verify it against a real map). */}
      <div className="grid gap-6 lg:grid-cols-[240px_1fr_380px]">
        <aside className="hidden lg:sticky lg:top-32 lg:block lg:max-h-[calc(100vh-9rem)] lg:self-start lg:overflow-y-auto lg:pe-2">
          <FilterPanel />
        </aside>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-h2">{t('title')}</h1>
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

          <div className="lg:hidden">
            <SearchMapToggle businesses={businesses} center={mapCenter} />
          </div>

          {businesses.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              {t('noResults')}
            </p>
          ) : (
            <div className="space-y-3">
              {businesses.map((business, index) => (
                <BusinessListItem
                  key={business.id}
                  business={business}
                  rank={
                    (query.page - 1) * (meta?.perPage ?? businesses.length) +
                    index +
                    1
                  }
                />
              ))}
            </div>
          )}

          <Pagination
            page={query.page}
            totalPages={totalPages}
            hrefFor={pageHref}
          />
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-32">
            <SearchMapToggle
              businesses={businesses}
              center={mapCenter}
              alwaysVisible
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
