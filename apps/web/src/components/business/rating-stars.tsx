import { Star } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface RatingStarsProps {
  rating: number | null;
  size?: 'sm' | 'md';
  className?: string;
}

const MAX_STARS = 5;

export function RatingStars({
  rating,
  size = 'sm',
  className,
}: RatingStarsProps): React.ReactElement {
  const value = rating ?? 0;
  const dimension = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5';

  return (
    <span
      className={cn('inline-flex items-center gap-0.5', className)}
      aria-hidden="true"
    >
      {Array.from({ length: MAX_STARS }, (_, index) => {
        const fillRatio = Math.max(0, Math.min(1, value - index));
        return (
          <span
            key={index}
            style={{ transitionDelay: `${index * 35}ms` }}
            className={cn(
              'relative inline-block transition-transform duration-200 ease-out group-hover:scale-110 motion-reduce:transform-none',
              dimension,
            )}
          >
            <Star className={cn(dimension, 'absolute inset-0 text-border')} />
            {fillRatio > 0 && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fillRatio * 100}%` }}
              >
                <Star
                  className={cn(dimension, 'fill-star-gold text-star-gold')}
                />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
