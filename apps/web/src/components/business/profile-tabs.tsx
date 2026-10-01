'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface ProfileTab {
  id: string;
  label: string;
}

/**
 * Sticky section tabs for the business profile. All sections stay on one server-rendered page (crawlable,
 * and the review form etc. stay reachable); the tabs jump to a section and highlight whichever is in view.
 * Sticky only from `lg`, where the site header's height is stable.
 */
export function ProfileTabs({
  tabs,
  label,
}: {
  tabs: ProfileTab[];
  label: string;
}): React.ReactElement {
  const [active, setActive] = React.useState(tabs[0]?.id);

  React.useEffect(() => {
    const sections = tabs
      .map((tab) => document.getElementById(tab.id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0 || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActive(visible[0].target.id);
        }
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [tabs]);

  return (
    <nav
      aria-label={label}
      className="z-30 border-b border-border bg-white lg:sticky lg:top-[7.1rem]"
    >
      <ul className="flex gap-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <a
              href={`#${tab.id}`}
              aria-current={active === tab.id ? 'location' : undefined}
              className={cn(
                'block whitespace-nowrap border-b-2 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active === tab.id
                  ? 'border-brand-500 text-ink'
                  : 'border-transparent text-muted-foreground hover:border-brand-500/60 hover:text-ink',
              )}
            >
              {tab.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
