'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { MapPin } from 'lucide-react';
import type { CitySummary } from '@buisnez/shared';
import { usePathname, useRouter } from '@/i18n/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const RESERVED_FIRST_SEGMENTS = new Set(['search', 'business']);

function currentCitySlugFromPathname(pathname: string): string | null {
  const [first] = pathname.split('/').filter(Boolean);
  if (!first || RESERVED_FIRST_SEGMENTS.has(first)) {
    return null;
  }
  return first;
}

export interface LocationPickerProps {
  cities: CitySummary[];
}

export function LocationPicker({
  cities,
}: LocationPickerProps): React.ReactElement {
  const t = useTranslations('locationPicker');
  const pathname = usePathname();
  const router = useRouter();

  const currentSlug = currentCitySlugFromPathname(pathname);
  const currentCity = cities.find((city) => city.slug === currentSlug);

  return (
    <Select
      value={currentCity?.slug}
      onValueChange={(slug) => {
        router.push(`/${slug}`);
      }}
    >
      <SelectTrigger
        aria-label={t('label')}
        className="h-9 w-auto min-w-[9rem] gap-1.5 border-none bg-transparent px-2 text-sm font-medium"
      >
        <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <SelectValue placeholder={t('placeholder')}>
          {currentCity?.name ?? t('placeholder')}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {cities.map((city) => (
          <SelectItem key={city.id} value={city.slug}>
            {city.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
