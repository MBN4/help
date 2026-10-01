import { Navigation, Pencil, Phone } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { formatPhonePK, toTelHref } from '@buisnez/shared';
import { FavoriteButton } from './favorite-button';
import { ShareButton } from './share-button';
import { Button } from '@/components/ui/button';

export interface BusinessProfileActionsProps {
  businessId: string;
  name: string;
  phone: string | null;
  directionsHref: string;
}

/** Action row under the photo mosaic (Yelp-style): primary Write a review, then Directions, Call, Save,
 * Share. Not sticky — the section tabs below own the sticky position. */
export async function BusinessProfileActions({
  businessId,
  name,
  phone,
  directionsHref,
}: BusinessProfileActionsProps): Promise<React.ReactElement> {
  const [t, navT] = await Promise.all([
    getTranslations('common'),
    getTranslations('nav'),
  ]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild size="sm">
        <a href="#reviews">
          <Pencil className="h-4 w-4" aria-hidden="true" />
          {navT('writeReview')}
        </a>
      </Button>
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
      <ShareButton title={name} />
    </div>
  );
}
