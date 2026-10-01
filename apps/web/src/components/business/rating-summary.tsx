import { getTranslations } from 'next-intl/server';
import type { BusinessAggregates } from '@buisnez/shared';
import { RatingStars } from './rating-stars';

/** Reviews header: big average, star row, and one proportional bar per star level (5 → 1). */
export async function RatingSummary({
  aggregates,
}: {
  aggregates: BusinessAggregates;
}): Promise<React.ReactElement | null> {
  if (aggregates.reviewCount === 0 || aggregates.averageRating === null) {
    return null;
  }
  const t = await getTranslations('business');

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:gap-8">
      <div className="flex shrink-0 flex-col items-start gap-1">
        <p className="font-display text-4xl font-bold text-ink">
          {aggregates.averageRating.toFixed(1)}
        </p>
        <RatingStars rating={aggregates.averageRating} size="md" />
        <p className="text-sm text-muted-foreground">
          {t('basedOnReviews', { count: aggregates.reviewCount })}
        </p>
      </div>
      <ul
        aria-label={t('ratingBreakdown')}
        className="w-full max-w-md flex-1 space-y-1.5"
      >
        {([5, 4, 3, 2, 1] as const).map((stars) => {
          const count = aggregates.ratingBreakdown[stars];
          const percent = (count / aggregates.reviewCount) * 100;
          return (
            <li key={stars} className="flex items-center gap-3 text-sm">
              <span className="w-12 shrink-0 text-muted-foreground">
                {t('starsLabel', { count: stars })}
              </span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-star-gold"
                  style={{ width: `${percent}%` }}
                />
              </span>
              <span className="w-6 shrink-0 text-end tabular-nums text-muted-foreground">
                {count}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
