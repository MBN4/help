'use client';

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function StarRatingInput({
  value,
  onChange,
  size = 'md',
}: {
  value: number;
  onChange: (value: number) => void;
  size?: 'sm' | 'md';
}): React.ReactElement {
  const dimension = size === 'sm' ? 'h-5 w-5' : 'h-7 w-7';

  return (
    <div className="inline-flex items-center gap-1" role="radiogroup">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          onClick={() => onChange(star)}
          className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Star
            className={cn(
              dimension,
              star <= value
                ? 'fill-accent text-accent'
                : 'text-muted-foreground/40',
            )}
          />
        </button>
      ))}
    </div>
  );
}
