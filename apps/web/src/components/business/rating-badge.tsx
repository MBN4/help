import { Star } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface RatingBadgeProps {
  rating: number | null;
  className?: string;
}

const MAX_STARS = 5;
const EMPTY = '#dcdcdc';

/** Yelp-style score colour — warmer/redder as the rating goes up. */
function colourFor(rating: number): string {
  if (rating >= 4.5) return '#f43939';
  if (rating >= 3.5) return '#ff643d';
  if (rating >= 2.5) return '#ff8742';
  if (rating >= 1.5) return '#ffad48';
  return '#ffcc4b';
}

/** Five rounded squares with white stars; fractional ratings fill a square partially from the left. */
export function RatingBadge({
  rating,
  className,
}: RatingBadgeProps): React.ReactElement {
  const value = rating ?? 0;
  const colour = colourFor(value);

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
            className="flex h-5 w-5 items-center justify-center rounded-[3px]"
            style={{
              background: `linear-gradient(to right, ${colour} ${fill}%, ${EMPTY} ${fill}%)`,
            }}
          >
            <Star className="h-3.5 w-3.5 fill-white text-white" />
          </span>
        );
      })}
    </span>
  );
}
