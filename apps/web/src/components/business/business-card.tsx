'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { MapPin, ShieldCheck } from 'lucide-react';
import type { BusinessSummary } from '@buisnez/shared';
import { Link } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
    <Card className="group overflow-hidden transition-shadow hover:shadow-md">
      <Link href={`/business/${business.slug}`} className="block">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {business.thumbnailUrl ? (
            <Image
              src={business.thumbnailUrl}
              alt={business.name}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 100vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <MapPin className="h-8 w-8" aria-hidden="true" />
            </div>
          )}
          <div className="absolute start-2 top-2">
            <OpenNowBadge isOpenNow={business.isOpenNow} />
          </div>
          <div className="absolute end-2 top-2">
            <FavoriteButton businessId={business.id} />
          </div>
        </div>
      </Link>
      <CardContent className="flex flex-col gap-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/business/${business.slug}`} className="min-w-0">
            <h3 className="truncate font-semibold leading-tight hover:underline">
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
