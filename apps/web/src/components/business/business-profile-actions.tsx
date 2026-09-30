import { Navigation, Phone } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { formatPhonePK, toTelHref } from '@buisnez/shared';
import { RatingStars } from './rating-stars';
import { OpenNowBadge } from './open-now-badge';
import { FavoriteButton } from './favorite-button';
import { Button } from '@/components/ui/button';

export interface BusinessProfileActionsProps {
  businessId: string;
  name: string;
  averageRating: number | null;
  reviewCount: number;
  isOpenNow: boolean;
  phone: string | null;
  directionsHref: string;
}

/** Sticky sub-header CTAs — docs/17-design-overhaul.md "business profile page": Directions/Call/Save/
 * Write a Review, always reachable while scrolling the rest of the profile. */
export async function BusinessProfileActions({
  businessId,
  name,
  averageRating,
  reviewCount,
  isOpenNow,
  phone,
  directionsHref,
}: BusinessProfileActionsProps): Promise<React.ReactElement> {
  const [t, navT] = await Promise.all([
    getTranslations('common'),
    getTranslations('nav'),
  ]);

  return (
    <div className="sticky top-16 z-30 rounded-xl border border-border bg-surface/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-bold">{name}</p>
          <div className="flex items-center gap-2 text-sm">
            <RatingStars rating={averageRating} />
            <span className="text-muted-foreground">({reviewCount})</span>
            <OpenNowBadge isOpenNow={isOpenNow} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={directionsHref} target="_blank" rel="noopener noreferrer">
              <Navigation className="h-4 w-4" aria-hidden="true" />
              {t('getDirections')}
            </a>
          </Button>
          {phone && (
            <Button asChild variant="outline" size="sm">
              <a href={toTelHref(phone) ?? undefined}>
                <Phone className="h-4 w-4" aria-hidden="true" />
                {formatPhonePK(phone)}
              </a>
            </Button>
          )}
          <FavoriteButton businessId={businessId} variant="full" />
          <Button asChild variant="accent" size="sm" className="rounded-pill">
            <a href="#reviews">{navT('writeReview')}</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
