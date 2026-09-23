'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import type { BusinessSort } from '@buisnez/shared';
import { useRouter } from '@/i18n/navigation';
import { withUpdatedParams } from '@/lib/utils/search-params';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SORT_OPTIONS: { value: BusinessSort; labelKey: string }[] = [
  { value: 'relevance', labelKey: 'sortRelevance' },
  { value: 'rating', labelKey: 'sortRating' },
  { value: 'distance', labelKey: 'sortDistance' },
  { value: 'reviews', labelKey: 'sortReviews' },
  { value: 'newest', labelKey: 'sortNewest' },
];

export function SortSelect({
  hasLocation,
}: {
  hasLocation: boolean;
}): React.ReactElement {
  const t = useTranslations('search');
  const router = useRouter();
  const searchParams = useSearchParams();
  const sort = (searchParams.get('sort') as BusinessSort | null) ?? 'relevance';
  const currentLabel = SORT_OPTIONS.find(
    (option) => option.value === sort,
  )?.labelKey;

  return (
    <Select
      value={sort}
      onValueChange={(value) =>
        router.push(
          `/search?${withUpdatedParams(searchParams, { sort: value }, false)}`,
        )
      }
    >
      <SelectTrigger className="w-44">
        <SelectValue placeholder={t('sortBy')}>
          {currentLabel ? t(currentLabel) : undefined}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.filter(
          (option) => option.value !== 'distance' || hasLocation,
        ).map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {t(option.labelKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
