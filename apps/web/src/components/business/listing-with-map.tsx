import type { BusinessSummary } from '@buisnez/shared';
import { SearchMapToggle } from '@/components/search/search-map-toggle';

/** Fallback view (centre of Pakistan) when none of the listed businesses has coordinates. */
const FALLBACK_CENTER = { lat: 30.3753, lng: 69.3451 };

/**
 * Yelp-style browse layout shared by the city and category pages: the list on the left and a sticky map on
 * the right at `lg`+; below `lg` the same map sits behind a "Show map" toggle above the list. Pins are
 * numbered to match the list, so `businesses` must be in the same order (and start at rank 1) as `children`.
 */
export function ListingWithMap({
  businesses,
  children,
}: {
  businesses: BusinessSummary[];
  children: React.ReactNode;
}): React.ReactElement {
  const center =
    businesses.find((business) => business.location)?.location ??
    FALLBACK_CENTER;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="min-w-0 space-y-3">
        <div className="lg:hidden">
          <SearchMapToggle businesses={businesses} center={center} />
        </div>
        {children}
      </div>
      <aside className="hidden lg:block">
        <div className="sticky top-32">
          <SearchMapToggle
            businesses={businesses}
            center={center}
            alwaysVisible
          />
        </div>
      </aside>
    </div>
  );
}
