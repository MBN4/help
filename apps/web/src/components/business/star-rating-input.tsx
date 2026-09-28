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

  // Roving tabindex radiogroup: only the selected (or first, if none selected) star is in the tab
  // order, and arrow keys move selection between stars — matching native <input type="radio"> behavior.
  function handleKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    star: number,
  ): void {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp': {
        event.preventDefault();
        onChange(Math.min(5, (value || star) + 1));
        break;
      }
      case 'ArrowLeft':
      case 'ArrowDown': {
        event.preventDefault();
        onChange(Math.max(1, (value || star) - 1));
        break;
      }
      case 'Enter':
      case ' ': {
        event.preventDefault();
        onChange(star);
        break;
      }
      default:
        break;
    }
  }

  return (
    <div className="inline-flex items-center gap-1" role="radiogroup">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          tabIndex={value === star || (!value && star === 1) ? 0 : -1}
          onClick={() => onChange(star)}
          onKeyDown={(event) => handleKeyDown(event, star)}
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
