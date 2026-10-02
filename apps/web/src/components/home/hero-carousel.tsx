'use client';

import * as React from 'react';
import Image from 'next/image';
import { Pause, Play, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { SearchBar } from '@/components/search/search-bar';
import { cn } from '@/lib/utils/cn';

const AUTOPLAY_MS = 7000;

const dotPattern =
  '[background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]';

interface Slide {
  title: string;
  cta: string;
  href: string;
  /** Optional full-bleed photo under the gradient — a `public/` path or an allowed remote host; gradient alone
   * when omitted. The current picsum.photos URLs are PLACEHOLDERS: swap in licensed brand photos. */
  image?: string;
  background: string;
  mobileSearch?: boolean;
}

/**
 * Homepage hero (Yelp-style): full-bleed slides, left-aligned headline + pill CTA, and a vertical timer rail
 * on the left — one bar per slide, the active bar fills over the slide duration and its animation ending
 * advances the carousel, so pausing can never drift out of sync with the timer.
 * Pause via the button; autoplay is off under `prefers-reduced-motion`. Inactive slides are `inert` + `aria-hidden`; the first
 * slide carries the page h1.
 */
export function HeroCarousel(): React.ReactElement {
  const t = useTranslations('home');
  const [index, setIndex] = React.useState(0);
  const [userPaused, setUserPaused] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(true);

  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);
    const onChange = (event: MediaQueryListEvent): void =>
      setReducedMotion(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const slides: Slide[] = [
    {
      title: t('heroTitle'),
      cta: t('searchCta'),
      href: '/search',
      image: 'https://picsum.photos/id/1060/1920/1080',
      background: 'from-brand-900 via-brand-700 to-brand-600',
      mobileSearch: true,
    },
    {
      title: t('slideReviewTitle'),
      cta: t('slideReviewCta'),
      href: '/search',
      image: 'https://picsum.photos/id/431/1920/1080',
      background: 'from-neutral-900 via-brand-900 to-brand-700',
    },
    {
      title: t('slideBusinessTitle'),
      cta: t('slideBusinessCta'),
      href: '/account/businesses',
      image: 'https://picsum.photos/id/835/1920/1080',
      background: 'from-brand-800 via-neutral-900 to-neutral-950',
    },
  ];

  const go = (next: number): void =>
    setIndex((next + slides.length) % slides.length);
  const paused = userPaused;
  const autoplay = !reducedMotion;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t('carouselLabel')}
      className="relative grid min-h-[34rem] overflow-hidden text-white sm:min-h-[40rem] lg:min-h-[44rem]"
    >
      {slides.map((slide, i) => {
        const active = i === index;
        const Heading = i === 0 ? 'h1' : 'h2';
        return (
          <div
            key={slide.title}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${slides.length}`}
            aria-hidden={!active}
            {...(!active ? { inert: true } : {})}
            className={cn(
              'relative col-start-1 row-start-1 flex items-start bg-gradient-to-br transition-opacity duration-500 ease-out',
              slide.background,
              active ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
          >
            {slide.image && (
              <Image
                src={slide.image}
                alt=""
                fill
                priority={i === 0}
                sizes="100vw"
                className="object-cover"
              />
            )}
            <div
              aria-hidden="true"
              className={cn('absolute inset-0 opacity-[0.07]', dotPattern)}
            />
            <div
              className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/35 to-black/10"
              aria-hidden="true"
            />
            <div className="container relative pb-16 pt-40 md:pt-36">
              <div className="ps-8 sm:ps-10">
                <Heading className="max-w-3xl font-display text-5xl font-extrabold leading-[1.05] text-white text-balance sm:text-6xl">
                  {slide.title}
                </Heading>
                <Link
                  href={slide.href}
                  className="mt-6 inline-flex items-center gap-2 rounded-pill bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Search className="h-5 w-5" aria-hidden="true" />
                  {slide.cta}
                </Link>
                {slide.mobileSearch && (
                  <div className="mt-6 max-w-xl md:hidden">
                    <SearchBar />
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-40 md:top-36">
        <div className="container relative h-full">
          <div className="pointer-events-auto absolute start-4 top-0 flex flex-col items-center gap-2.5 sm:start-4">
            {slides.map((slide, i) => {
              const active = i === index;
              return (
                <button
                  key={slide.title}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={t('slideDot', { n: i + 1 })}
                  aria-current={active}
                  className="relative h-12 w-1.5 overflow-hidden rounded-full bg-white/40 transition-[height] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40 sm:h-14"
                >
                  {active && (
                    <span
                      key={index}
                      aria-hidden="true"
                      onAnimationEnd={() => go(index + 1)}
                      className={cn(
                        'absolute inset-0 origin-top rounded-full bg-white',
                        autoplay && 'animate-hero-progress',
                      )}
                      style={{
                        animationDuration: `${AUTOPLAY_MS}ms`,
                        animationTimingFunction: 'linear',
                        animationFillMode: 'forwards',
                        animationPlayState: paused ? 'paused' : 'running',
                      }}
                    />
                  )}
                </button>
              );
            })}
            {autoplay && (
              <button
                type="button"
                onClick={() => setUserPaused((value) => !value)}
                aria-label={userPaused ? t('slidePlay') : t('slidePause')}
                className="mt-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/80 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {userPaused ? (
                  <Play className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <Pause className="h-3 w-3" aria-hidden="true" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
