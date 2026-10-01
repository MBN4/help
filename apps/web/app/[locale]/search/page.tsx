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
import { BusinessListItem } from '@/components/business/business-list-item';
import { cn } from '@/lib/utils/cn';
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

/** Page numbers to render: always first/last, a window around the current page, `null` marks a gap. */
function pageWindow(current: number, total: number): (number | null)[] {
  const pages = new Set<number>([1, total]);
  for (let p = current - 1; p <= current + 1; p += 1) {
    if (p >= 1 && p <= total) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | null)[] = [];
  sorted.forEach((page, i) => {
    if (i > 0 && page - sorted[i - 1]! > 1) result.push(null);
    result.push(page);
  });
  return result;
}

function PageLink({
  href,
  label,
  current = false,
  children,
}: {
  href: string;
  label: string;
  current?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        current
          ? 'border-saffron-500 bg-saffron-500 text-ink'
          : 'border-border bg-card text-ink hover:bg-saffron-100',
      )}
    >
      {children}
    </Link>
  );
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

          {totalPages > 1 && (
            <nav
              className="flex flex-wrap items-center justify-center gap-1 pt-4"
              aria-label={t('paginationLabel')}
            >
              {query.page > 1 && (
                <PageLink
                  href={pageHref(query.page - 1)}
                  label={t('previousPage')}
                >
                  ←
                </PageLink>
              )}
              {pageWindow(query.page, totalPages).map((entry, i) =>
                entry === null ? (
                  <span
                    key={`gap-${i}`}
                    className="px-2 text-muted-foreground"
                    aria-hidden="true"
                  >
                    …
                  </span>
                ) : (
                  <PageLink
                    key={entry}
                    href={pageHref(entry)}
                    label={t('goToPage', { page: entry })}
                    current={entry === query.page}
                  >
                    {entry}
                  </PageLink>
                ),
              )}
              {query.page < totalPages && (
                <PageLink href={pageHref(query.page + 1)} label={t('nextPage')}>
                  →
                </PageLink>
              )}
            </nav>
          )}
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
