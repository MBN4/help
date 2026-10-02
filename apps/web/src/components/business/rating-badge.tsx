import { Star } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface RatingBadgeProps {
  rating: number | null;
  /** `sm` for cards/lists, `md` for the business page header and rating summary. */
  size?: 'sm' | 'md';
  className?: string;
}

const MAX_STARS = 5;
const EMPTY = '#dcdcdc';

const SIZES = {
  sm: { square: 'h-5 w-5', star: 'h-3.5 w-3.5' },
  md: { square: 'h-7 w-7', star: 'h-5 w-5' },
} as const;

/** Yelp-style score colour — warmer/redder as the rating goes up. */
export function ratingColour(rating: number): string {
  if (rating >= 4.5) return '#f43939';
  if (rating >= 3.5) return '#ff643d';
  if (rating >= 2.5) return '#ff8742';
  if (rating >= 1.5) return '#ffad48';
  return '#ffcc4b';
}

/** Five rounded squares with white stars; fractional ratings fill a square partially from the left. */
export function RatingBadge({
  rating,
  size = 'sm',
  className,
}: RatingBadgeProps): React.ReactElement {
  const value = rating ?? 0;
  const colour = ratingColour(value);
  const dimension = SIZES[size];

  return (
    <span
      className={cn('inline-flex items-center gap-0.5', className)}
      aria-hidden="true"
    >
      {Array.from({ length: MAX_STARS }, (_, index) => {
        const fill = Math.max(0, Math.min(1, value - index)) * 100;
        return (
          <span
            key={index}
            className={cn(
              'flex items-center justify-center rounded-[3px]',
              dimension.square,
            )}
            style={{
              background: `linear-gradient(to right, ${colour} ${fill}%, ${EMPTY} ${fill}%)`,
            }}
          >
            <Star className={cn('fill-white text-white', dimension.star)} />
          </span>
        );
      })}
    </span>
  );
}
