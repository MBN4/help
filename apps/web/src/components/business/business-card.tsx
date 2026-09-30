'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { MapPin, ShieldCheck } from 'lucide-react';
import type { BusinessSummary } from '@buisnez/shared';
import { Link } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RatingStars } from './rating-stars';
import { PriceLevel } from './price-level';
import { OpenNowBadge } from './open-now-badge';
import { FavoriteButton } from './favorite-button';

export interface BusinessCardProps {
  business: BusinessSummary;
}

export function BusinessCard({
  business,
}: BusinessCardProps): React.ReactElement {
  const t = useTranslations('common');

  return (
    <Card className="card-hover group relative overflow-hidden">
      {/* FavoriteButton's logged-out state renders its own <a> (a login link) — nesting it inside this
          image link would put an <a> inside an <a>, which is invalid HTML and caused a real hydration
          failure (found via browser console during this pass, pre-existing before this redesign). Kept
          as a sibling, absolutely positioned over the same image area, instead. */}
      <Link
        href={`/business/${business.slug}`}
        className="block"
        aria-label={business.name}
      >
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          {business.thumbnailUrl ? (
            <Image
              src={business.thumbnailUrl}
              alt={business.name}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 100vw"
              className="card-hover-image object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <MapPin className="h-8 w-8" aria-hidden="true" />
            </div>
          )}
        </div>
      </Link>
      <div className="pointer-events-none absolute start-2 top-2">
        <OpenNowBadge isOpenNow={business.isOpenNow} />
      </div>
      <div className="absolute end-2 top-2">
        <FavoriteButton businessId={business.id} />
      </div>
      <CardContent className="flex flex-col gap-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/business/${business.slug}`} className="min-w-0">
            <h3 className="truncate font-display text-base font-bold leading-tight hover:underline">
              {business.name}
            </h3>
          </Link>
          {business.isVerified && (
            <Badge variant="outline" className="shrink-0 gap-1">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              {t('verified')}
            </Badge>
          )}
        </div>

        <p className="truncate text-sm text-muted-foreground">
          {business.category.name} · {business.area?.name ?? business.city.name}
        </p>

        <div className="flex items-center gap-2 text-sm">
          <RatingStars rating={business.averageRating} />
          {business.averageRating !== null && (
            <span className="font-medium text-ink">
              {business.averageRating.toFixed(1)}
            </span>
          )}
          <span className="text-muted-foreground">
            {t('reviewsCount', { count: business.reviewCount })}
          </span>
          <PriceLevel tier={business.priceTier} />
        </div>

        {business.distanceMeters !== null && (
          <p className="text-xs text-muted-foreground">
            {(business.distanceMeters / 1000).toFixed(1)} km
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Loading placeholder matching BusinessCard's layout — docs/17-design-overhaul.md "skeleton variant". */
export function BusinessCardSkeleton(): React.ReactElement {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-video w-full rounded-none" />
      <CardContent className="flex flex-col gap-2 p-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
    </Card>
  );
}
