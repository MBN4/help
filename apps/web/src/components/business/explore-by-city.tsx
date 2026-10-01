'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { CitySummary } from '@buisnez/shared';
import { Link } from '@/i18n/navigation';
import { searchBusinesses } from '@/lib/api';
import { cn } from '@/lib/utils/cn';
import { RatingStars } from './rating-stars';
import { Skeleton } from '@/components/ui/skeleton';

export interface ExploreByCityProps {
  cities: CitySummary[];
  defaultCitySlug: string;
}

const COLUMN_LIMIT = 5;

/**
 * docs/17-design-overhaul.md section 4: city chips + "Popular in {city}" / "Trending in {city}"
 * columns, composed entirely from the existing `GET /businesses` search endpoint (no new endpoint) —
 * "popular" = highest-rated (`sort=rating`), "trending" = most-reviewed (`sort=reviews`), since Buisnez
 * has no search-term tracking to build a literal "top searches" block from (the spec explicitly says
 * not to fabricate one).
 */
export function ExploreByCity({
  cities,
  defaultCitySlug,
}: ExploreByCityProps): React.ReactElement {
  const t = useTranslations('home');
  const orderedCities = React.useMemo(() => {
    const lead = cities.find((c) => c.slug === defaultCitySlug);
    const rest = cities.filter((c) => c.slug !== defaultCitySlug);
    return lead ? [lead, ...rest] : cities;
  }, [cities, defaultCitySlug]);

  const [activeSlug, setActiveSlug] = React.useState(defaultCitySlug);
  const activeCity =
    orderedCities.find((c) => c.slug === activeSlug) ?? orderedCities[0];

  const popularQuery = useQuery({
    queryKey: ['explore-by-city', 'popular', activeSlug],
    queryFn: async () =>
      (
        await searchBusinesses({
          city: activeSlug,
          sort: 'rating',
          perPage: COLUMN_LIMIT,
        })
      ).data,
    staleTime: 5 * 60_000,
  });

  const trendingQuery = useQuery({
    queryKey: ['explore-by-city', 'trending', activeSlug],
    queryFn: async () =>
      (
        await searchBusinesses({
          city: activeSlug,
          sort: 'reviews',
          perPage: COLUMN_LIMIT,
        })
      ).data,
    staleTime: 5 * 60_000,
  });

  return (
    <section className="space-y-4">
      <h2 className="font-display text-h2">{t('exploreByCity')}</h2>

      <div
        role="tablist"
        aria-label={t('exploreByCity')}
        className="flex flex-wrap gap-2"
      >
        {orderedCities.slice(0, 10).map((city) => (
          <button
            key={city.id}
            type="button"
            role="tab"
            aria-selected={city.slug === activeSlug}
            onClick={() => setActiveSlug(city.slug)}
            className={cn(
              'rounded-pill border px-4 py-1.5 text-sm font-medium transition-colors',
              city.slug === activeSlug
                ? 'border-saffron-500 bg-saffron-500 text-ink'
                : 'border-border bg-card text-foreground hover:border-saffron-500 hover:text-saffron-700',
            )}
          >
            {city.name}
          </button>
        ))}
      </div>

      {activeCity && (
        <div className="grid gap-6 sm:grid-cols-2">
          <BusinessLinkColumn
            title={t('popularIn', { city: activeCity.name })}
            businesses={popularQuery.data}
            isLoading={popularQuery.isLoading}
          />
          <BusinessLinkColumn
            title={t('trendingIn', { city: activeCity.name })}
            businesses={trendingQuery.data}
            isLoading={trendingQuery.isLoading}
          />
        </div>
      )}
    </section>
  );
}

function BusinessLinkColumn({
  title,
  businesses,
  isLoading,
}: {
  title: string;
  businesses:
    | { id: string; slug: string; name: string; averageRating: number | null }[]
    | undefined;
  isLoading: boolean;
}): React.ReactElement {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 font-display text-sm font-bold text-ink">{title}</h3>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : businesses && businesses.length > 0 ? (
        <ol className="space-y-2">
          {businesses.map((business, index) => (
            <li key={business.id} className="flex items-center gap-2 text-sm">
              <span className="w-4 shrink-0 text-muted-foreground">
                {index + 1}
              </span>
              <Link
                href={`/business/${business.slug}`}
                className="min-w-0 flex-1 truncate hover:text-saffron-700 hover:underline"
              >
                {business.name}
              </Link>
              <RatingStars rating={business.averageRating} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">—</p>
      )}
    </div>
  );
}
