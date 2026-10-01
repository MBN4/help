'use client';

import * as React from 'react';
import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';

/**
 * Whole-star rating input (ratings are stored as integers 1–5). Hovering previews the fill up to that
 * star, selecting plays a small pop on the chosen star, and a word ("Good") follows the preview.
 * Motion is disabled under `prefers-reduced-motion`.
 */
export function StarRatingInput({
  value,
  onChange,
  size = 'md',
}: {
  value: number;
  onChange: (value: number) => void;
  size?: 'sm' | 'md';
}): React.ReactElement {
  const t = useTranslations('review');
  const [hover, setHover] = React.useState(0);
  const [popped, setPopped] = React.useState(0);
  const dimension = size === 'sm' ? 'h-5 w-5' : 'h-7 w-7';
  const shown = hover || value;

  function select(star: number): void {
    onChange(star);
    setPopped(0);
    // Re-trigger the CSS animation even when the same star is chosen twice.
    window.requestAnimationFrame(() => setPopped(star));
  }

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
        select(Math.min(5, (value || star) + 1));
        break;
      }
      case 'ArrowLeft':
      case 'ArrowDown': {
        event.preventDefault();
        select(Math.max(1, (value || star) - 1));
        break;
      }
      case 'Enter':
      case ' ': {
        event.preventDefault();
        select(star);
        break;
      }
      default:
        break;
    }
  }

  return (
    <div className="inline-flex items-center gap-3">
      <div
        className="inline-flex items-center gap-1"
        role="radiogroup"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            tabIndex={value === star || (!value && star === 1) ? 0 : -1}
            onClick={() => select(star)}
            onMouseEnter={() => setHover(star)}
            onFocus={() => setHover(0)}
            onKeyDown={(event) => handleKeyDown(event, star)}
            className={cn(
              'rounded-sm transition-transform duration-150 ease-out hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none',
              popped === star && 'animate-pop motion-reduce:animate-none',
            )}
          >
            <Star
              className={cn(
                dimension,
                'transition-colors duration-150',
                star <= shown
                  ? 'fill-star-gold text-star-gold'
                  : 'text-muted-foreground/40',
              )}
            />
          </button>
        ))}
      </div>
      <span
        aria-hidden="true"
        className="min-w-16 text-sm font-medium text-ink transition-opacity duration-150"
      >
        {shown > 0 ? t(`ratingWord${shown}` as 'ratingWord1') : ''}
      </span>
    </div>
  );
}
