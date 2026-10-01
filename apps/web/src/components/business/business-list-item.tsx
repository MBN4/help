'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { MapPin, ShieldCheck } from 'lucide-react';
import type { BusinessSummary } from '@buisnez/shared';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';
import { RatingStars } from './rating-stars';
import { PriceLevel } from './price-level';
import { FavoriteButton } from './favorite-button';

export interface BusinessListItemProps {
  business: BusinessSummary;
  /** 1-based position across all result pages, shown before the name ("1. Name"). */
  rank?: number;
}

/**
 * Horizontal search-result row (Yelp-style): thumbnail left, numbered name, stars, tag chips, open status.
 * The title link is stretched over the whole row (`after:inset-0`), so the row has a single anchor and the
 * favourite button — which can render its own login <a> — stays a sibling above it, never nested inside.
 */
export function BusinessListItem({
  business,
  rank,
}: BusinessListItemProps): React.ReactElement {
  const t = useTranslations('common');
  const place = business.area?.name ?? business.city.name;

  return (
    <article className="group relative flex gap-4 rounded-lg border border-border bg-card p-3 transition-shadow duration-[var(--motion-duration)] ease-out hover:shadow-md focus-within:shadow-md sm:p-4">
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-md bg-muted sm:h-36 sm:w-44">
        {business.thumbnailUrl ? (
          <Image
            src={business.thumbnailUrl}
            alt=""
            fill
            sizes="(min-width: 640px) 176px, 112px"
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transform-none"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <MapPin className="h-8 w-8" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 font-display text-base font-bold leading-tight sm:text-lg">
            <Link
              href={`/business/${business.slug}`}
              className="after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {rank !== undefined && (
                <span className="text-muted-foreground">{rank}. </span>
              )}
              {business.name}
            </Link>
          </h3>
          <div className="relative z-10 -mt-1 shrink-0">
            <FavoriteButton businessId={business.id} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <RatingStars rating={business.averageRating} />
          {business.averageRating !== null && (
            <span className="font-medium text-ink">
              {business.averageRating.toFixed(1)}
            </span>
          )}
          <span className="text-muted-foreground">
            {t('reviewsCount', { count: business.reviewCount })}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span className="rounded-pill bg-muted px-2.5 py-0.5 text-xs font-medium text-ink">
            {business.category.name}
          </span>
          <PriceLevel tier={business.priceTier} />
          <span aria-hidden="true">·</span>
          <span>{place}</span>
          {business.distanceMeters !== null && (
            <>
              <span aria-hidden="true">·</span>
              <span>{(business.distanceMeters / 1000).toFixed(1)} km</span>
            </>
          )}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 text-sm">
          <span
            className={cn(
              'font-semibold',
              business.isOpenNow ? 'text-brand-700' : 'text-muted-foreground',
            )}
          >
            {business.isOpenNow ? t('openNow') : t('closedNow')}
          </span>
          {business.isVerified && (
            <Badge variant="outline" className="gap-1">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              {t('verified')}
            </Badge>
          )}
        </div>
      </div>
    </article>
  );
}

export function BusinessListItemSkeleton(): React.ReactElement {
  return (
    <div className="flex gap-4 rounded-lg border border-border bg-card p-4">
      <Skeleton className="h-36 w-44 shrink-0 rounded-md" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}
