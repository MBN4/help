'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/search/search-bar';
import { cn } from '@/lib/utils/cn';

const SLIDE_COUNT = 3;
const AUTOPLAY_MS = 7000;

const dotPattern =
  '[background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]';

/**
 * Homepage promo carousel (Yelp-style): three fading slides with arrows and dots. Autoplay pauses on
 * hover/focus and is off entirely under `prefers-reduced-motion`. Inactive slides are `inert` +
 * `aria-hidden`, so only the visible slide is focusable or announced; the first slide carries the page h1.
 */
export function HeroCarousel(): React.ReactElement {
  const t = useTranslations('home');
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(true);

  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);
    const onChange = (event: MediaQueryListEvent): void =>
      setReducedMotion(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  React.useEffect(() => {
    if (paused || reducedMotion) {
      return;
    }
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % SLIDE_COUNT),
      AUTOPLAY_MS,
    );
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion]);

  const go = (next: number): void =>
    setIndex((next + SLIDE_COUNT) % SLIDE_COUNT);

  const slideClass = (i: number): string =>
    cn(
      'absolute inset-0 flex items-center justify-center px-4 text-center transition-opacity duration-500 ease-out',
      i === index ? 'opacity-100' : 'pointer-events-none opacity-0',
    );
  const slideProps = (i: number): React.HTMLAttributes<HTMLDivElement> => ({
    role: 'group',
    'aria-roledescription': 'slide',
    'aria-label': `${i + 1} / ${SLIDE_COUNT}`,
    'aria-hidden': i !== index,
    ...(i !== index ? { inert: true } : {}),
  });

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t('carouselLabel')}
      className="relative h-[26rem] overflow-hidden text-white sm:h-[28rem]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        {...slideProps(0)}
        className={cn(
          slideClass(0),
          'bg-gradient-to-br from-emerald-900 via-emerald-700 to-emerald-500',
        )}
      >
        <div
          aria-hidden="true"
          className={cn('absolute inset-0 opacity-10', dotPattern)}
        />
        <div className="relative mx-auto w-full max-w-3xl space-y-6">
          <h1 className="font-display text-display font-bold text-white text-balance">
            {t('heroTitle')}
          </h1>
          <p className="text-white/85">{t('heroSubtitle')}</p>
          <SearchBar />
        </div>
      </div>

      <div
        {...slideProps(1)}
        className={cn(
          slideClass(1),
          'bg-gradient-to-br from-saffron-500 to-saffron-100 text-ink',
        )}
      >
        <div className="relative mx-auto max-w-2xl space-y-5">
          <h2 className="font-display text-display font-bold text-ink text-balance">
            {t('slideReviewTitle')}
          </h2>
          <p className="text-lg text-ink/85">{t('slideReviewBody')}</p>
          <Button
            asChild
            size="lg"
            className="bg-ink text-white hover:bg-ink/90"
          >
            <Link href="/search">{t('slideReviewCta')}</Link>
          </Button>
        </div>
      </div>

      <div {...slideProps(2)} className={cn(slideClass(2), 'bg-ink')}>
        <div
          aria-hidden="true"
          className={cn('absolute inset-0 opacity-[0.07]', dotPattern)}
        />
        <div className="relative mx-auto max-w-2xl space-y-5">
          <h2 className="font-display text-display font-bold text-white text-balance">
            {t('slideBusinessTitle')}
          </h2>
          <p className="text-lg text-white/85">{t('slideBusinessBody')}</p>
          <Button asChild size="lg">
            <Link href="/account/businesses">{t('slideBusinessCta')}</Link>
          </Button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => go(index - 1)}
        aria-label={t('slidePrev')}
        className="absolute start-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-md transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"
      >
        <ChevronLeft className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => go(index + 1)}
        aria-label={t('slideNext')}
        className="absolute end-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-md transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"
      >
        <ChevronRight className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
      </button>

      <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
        {Array.from({ length: SLIDE_COUNT }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => go(i)}
            aria-label={t('slideDot', { n: i + 1 })}
            aria-current={i === index}
            className={cn(
              'h-2.5 rounded-full bg-white/70 ring-1 ring-black/20 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              i === index ? 'w-6 bg-white' : 'w-2.5 hover:bg-white',
            )}
          />
        ))}
      </div>
    </section>
  );
}
