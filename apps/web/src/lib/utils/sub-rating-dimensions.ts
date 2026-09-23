/**
 * Category-specific sub-rating dimensions shown on the review form, keyed by top-level category slug
 * (see docs/01-product-overview.md for the category tree). Not exhaustive by design — anything not listed
 * falls back to the generic `service`/`value` pair, since those apply to virtually any business.
 */
const DIMENSIONS_BY_TOP_CATEGORY: Record<string, string[]> = {
  'food-dining': ['food', 'service', 'ambience', 'value'],
  'beauty-wellness': ['service', 'ambience', 'value'],
  'health-medical': ['service', 'value'],
  automotive: ['service', 'value'],
  'home-services': ['service', 'value'],
  'shopping-retail': ['value', 'service'],
};

const DEFAULT_DIMENSIONS = ['service', 'value'];

const LABEL_KEY_BY_DIMENSION: Record<string, string> = {
  food: 'subRatingFood',
  service: 'subRatingService',
  ambience: 'subRatingAmbience',
  value: 'subRatingValue',
};

export function subRatingDimensionsForCategory(
  topLevelCategorySlug: string,
): string[] {
  return DIMENSIONS_BY_TOP_CATEGORY[topLevelCategorySlug] ?? DEFAULT_DIMENSIONS;
}

export function subRatingLabelKey(dimension: string): string {
  return LABEL_KEY_BY_DIMENSION[dimension] ?? 'subRatingService';
}
