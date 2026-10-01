'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/** Sticky white header frame — gains a soft shadow once the page has scrolled (Yelp-style). */
export function HeaderShell({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-border bg-white text-ink transition-shadow duration-[var(--motion-duration)]',
        scrolled && 'shadow-md',
      )}
    >
      {children}
    </header>
  );
}
