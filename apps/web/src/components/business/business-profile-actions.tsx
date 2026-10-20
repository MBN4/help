import { MessageCircle, Navigation, Pencil, Phone } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import {
  buildWhatsAppHref,
  formatPhonePK,
  getWhatsAppTarget,
  toTelHref,
} from '@buisnez/shared';
import { FavoriteButton } from './favorite-button';
import { ShareButton } from './share-button';
import { Button } from '@/components/ui/button';

export interface BusinessProfileActionsProps {
  businessId: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  directionsHref: string;
}

/** Action row under the photo mosaic (Yelp-style): primary Write a review, then Directions, Call, WhatsApp, Save,
 * Share. Not sticky — the section tabs below own the sticky position. */
export async function BusinessProfileActions({
  businessId,
  name,
  phone,
  whatsapp,
  directionsHref,
}: BusinessProfileActionsProps): Promise<React.ReactElement> {
  const [t, navT, whatsappT] = await Promise.all([
    getTranslations('common'),
    getTranslations('nav'),
    getTranslations('whatsapp'),
  ]);
  const whatsappTarget = getWhatsAppTarget({ whatsapp, phone });

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
      {whatsappTarget && (
        <Button asChild variant="outline" size="sm">
          <a
            href={buildWhatsAppHref(
              whatsappTarget,
              whatsappT('prefilledMessage'),
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle
              className="h-4 w-4 text-[#25D366]"
              aria-hidden="true"
            />
            {t('whatsapp')}
          </a>
        </Button>
      )}
      <FavoriteButton businessId={businessId} variant="full" />
      <ShareButton title={name} />
    </div>
  );
}
