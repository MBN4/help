'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useCategoryTree } from '@/lib/hooks/use-categories';
import { useCities } from '@/lib/hooks/use-cities';
import { useAreas } from '@/lib/hooks/use-areas';
import { useFeatures } from '@/lib/hooks/use-features';
import { withUpdatedParams } from '@/lib/utils/search-params';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils/cn';

const PRICE_TIERS = ['ONE', 'TWO', 'THREE', 'FOUR'] as const;
const PRICE_SYMBOL: Record<string, string> = {
  ONE: '$',
  TWO: '$$',
  THREE: '$$$',
  FOUR: '$$$$',
};
const RATING_OPTIONS = [4, 3, 2, 1];
const FEATURES_PREVIEW = 6;

export function FilterPanel(): React.ReactElement {
  const t = useTranslations('search');
  const router = useRouter();
  const searchParams = useSearchParams();

  const category = searchParams.get('category') ?? undefined;
  const city = searchParams.get('city') ?? undefined;
  const area = searchParams.get('area') ?? undefined;
  const minRating = searchParams.get('minRating') ?? undefined;
  const openNow = searchParams.get('openNow') === 'true';
  const selectedPriceLevels = new Set(
    (searchParams.get('priceLevel') ?? '').split(',').filter(Boolean),
  );
  const selectedFeatures = new Set(
    (searchParams.get('features') ?? '').split(',').filter(Boolean),
  );

  const [showAllFeatures, setShowAllFeatures] = React.useState(false);
  const { data: categories } = useCategoryTree();
  const { data: cities } = useCities();
  const { data: areas } = useAreas(city);
  const { data: features } = useFeatures();

  function apply(updates: Record<string, string | undefined>): void {
    router.push(`/search?${withUpdatedParams(searchParams, updates)}`);
  }

  function toggleInSet(
    param: 'priceLevel' | 'features',
    set: Set<string>,
    value: string,
  ): void {
    const next = new Set(set);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    apply({ [param]: next.size > 0 ? Array.from(next).join(',') : undefined });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">{t('filters')}</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push('/search')}
        >
          {t('clearFilters')}
        </Button>
      </div>

      <label className="flex items-center gap-1.5 text-sm font-medium">
        <Checkbox
          checked={openNow}
          onCheckedChange={(checked) =>
            apply({ openNow: checked ? 'true' : undefined })
          }
        />
        {t('openNowOnly')}
      </label>

      <Separator />

      <div className="space-y-1.5">
        <Label>{t('category')}</Label>
        <Select
          value={category}
          onValueChange={(value) => apply({ category: value })}
        >
          <SelectTrigger aria-label={t('category')}>
            <SelectValue placeholder={t('allCategories')}>
              {categories?.find((node) => node.slug === category)?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {categories?.map((node) => (
              <SelectItem key={node.id} value={node.slug}>
                {node.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>{t('city')}</Label>
        <Select
          value={city}
          onValueChange={(value) => apply({ city: value, area: undefined })}
        >
          <SelectTrigger aria-label={t('city')}>
            <SelectValue placeholder={t('allCities')}>
              {cities?.find((c) => c.slug === city)?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {cities?.map((c) => (
              <SelectItem key={c.id} value={c.slug}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {city && (
        <div className="space-y-1.5">
          <Label>{t('area')}</Label>
          <Select
            value={area}
            onValueChange={(value) => apply({ area: value })}
          >
            <SelectTrigger aria-label={t('area')}>
              <SelectValue placeholder={t('allAreas')}>
                {areas?.find((a) => a.slug === area)?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {areas?.map((a) => (
                <SelectItem key={a.id} value={a.slug}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>{t('minRating')}</Label>
        <Select
          value={minRating}
          onValueChange={(value) => apply({ minRating: value })}
        >
          <SelectTrigger aria-label={t('minRating')}>
            <SelectValue placeholder={t('anyRating')}>
              {minRating ? t('ratingAndUp', { rating: minRating }) : undefined}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {RATING_OPTIONS.map((rating) => (
              <SelectItem key={rating} value={String(rating)}>
                {t('ratingAndUp', { rating })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label>{t('priceLevel')}</Label>
        <div className="flex gap-2" role="group" aria-label={t('priceLevel')}>
          {PRICE_TIERS.map((tier) => {
            const active = selectedPriceLevels.has(tier);
            return (
              <button
                key={tier}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  toggleInSet('priceLevel', selectedPriceLevels, tier)
                }
                className={cn(
                  'h-9 flex-1 rounded-md border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'border-saffron-500 bg-saffron-500 text-ink'
                    : 'border-border bg-card text-ink hover:bg-saffron-100',
                )}
              >
                {PRICE_SYMBOL[tier]}
              </button>
            );
          })}
        </div>
      </div>

      {features && features.length > 0 && (
        <div className="space-y-1.5">
          <Label>{t('features')}</Label>
          <div className="space-y-1.5">
            {(showAllFeatures
              ? features
              : features.slice(0, FEATURES_PREVIEW)
            ).map((feature) => (
              <label
                key={feature.id}
                className="flex items-center gap-1.5 text-sm"
              >
                <Checkbox
                  checked={selectedFeatures.has(feature.slug)}
                  onCheckedChange={() =>
                    toggleInSet('features', selectedFeatures, feature.slug)
                  }
                />
                {feature.name}
              </label>
            ))}
            {features.length > FEATURES_PREVIEW && (
              <button
                type="button"
                onClick={() => setShowAllFeatures((value) => !value)}
                aria-expanded={showAllFeatures}
                className="text-sm font-medium text-saffron-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {showAllFeatures ? t('showFewer') : t('showMore')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
