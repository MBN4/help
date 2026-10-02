'use client';

import * as React from 'react';
import { usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils/cn';

/**
 * Header frame. On the homepage it floats transparent over the hero (Yelp-style) with light text until the
 * page scrolls; everywhere else it is a sticky white bar that gains a soft shadow on scroll. Children style
 * the overlay state with `group-data-[overlay=true]/hdr:` variants.
 */
export function HeaderShell({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [scrolled, setScrolled] = React.useState(false);
  const isHome = usePathname() === '/';

  React.useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const overlay = isHome && !scrolled;

  return (
    <header
      data-overlay={overlay}
      className={cn(
        'group/hdr top-0 z-40 border-b transition-[background-color,box-shadow] duration-[var(--motion-duration)]',
        isHome ? 'fixed inset-x-0' : 'sticky',
        overlay
          ? 'border-transparent bg-gradient-to-b from-black/50 to-transparent text-white'
          : 'border-border bg-white text-ink',
        scrolled && 'shadow-md',
      )}
    >
      {children}
    </header>
  );
}
