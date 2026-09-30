import type { BusinessServiceItem } from '@buisnez/shared';
import { formatPKR } from '@buisnez/shared';
import { useTranslations } from 'next-intl';

export interface ServicesMenuProps {
  services: BusinessServiceItem[];
}

/** Public rendering of `BusinessProfile.services` (docs/17-design-overhaul.md "Services/Menu" section) —
 * the data already flows to this page via the existing profile endpoint; it was just never displayed
 * publicly before this pass (owner-only editor rendered it, the public page didn't). No API change. */
export function ServicesMenu({
  services,
}: ServicesMenuProps): React.ReactElement | null {
  const t = useTranslations('business');
  const available = services.filter((service) => service.isAvailable);
  if (available.length === 0) {
    return null;
  }

  return (
    <section id="services" className="scroll-mt-40 space-y-3">
      <h2 className="font-display text-h2">{t('servicesMenu')}</h2>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {available.map((service) => (
          <li
            key={service.id}
            className="flex items-start justify-between gap-4 p-4"
          >
            <div className="min-w-0">
              <p className="font-medium text-ink">{service.name}</p>
              {service.description && (
                <p className="text-sm text-muted-foreground">
                  {service.description}
                </p>
              )}
            </div>
            <p className="shrink-0 whitespace-nowrap font-medium text-ink">
              {service.priceInPaisa !== null
                ? formatPKR(service.priceInPaisa)
                : t('priceOnRequest')}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
