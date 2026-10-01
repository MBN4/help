import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils/cn';

/** Page numbers to render: always first/last, a window around the current page, `null` marks a gap. */
function pageWindow(current: number, total: number): (number | null)[] {
  const pages = new Set<number>([1, total]);
  for (let p = current - 1; p <= current + 1; p += 1) {
    if (p >= 1 && p <= total) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | null)[] = [];
  sorted.forEach((page, i) => {
    if (i > 0 && page - sorted[i - 1]! > 1) result.push(null);
    result.push(page);
  });
  return result;
}

function PageLink({
  href,
  label,
  current = false,
  children,
}: {
  href: string;
  label: string;
  current?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        current
          ? 'border-saffron-500 bg-saffron-500 text-ink'
          : 'border-border bg-card text-ink hover:bg-saffron-100',
      )}
    >
      {children}
    </Link>
  );
}

/** Numbered pagination (`1 … 4 5 6 … 20`) shared by search and the city/category listings. */
export async function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}): Promise<React.ReactElement | null> {
  if (totalPages <= 1) {
    return null;
  }
  const t = await getTranslations('search');

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-1 pt-4"
      aria-label={t('paginationLabel')}
    >
      {page > 1 && (
        <PageLink href={hrefFor(page - 1)} label={t('previousPage')}>
          ←
        </PageLink>
      )}
      {pageWindow(page, totalPages).map((entry, i) =>
        entry === null ? (
          <span
            key={`gap-${i}`}
            className="px-2 text-muted-foreground"
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <PageLink
            key={entry}
            href={hrefFor(entry)}
            label={t('goToPage', { page: entry })}
            current={entry === page}
          >
            {entry}
          </PageLink>
        ),
      )}
      {page < totalPages && (
        <PageLink href={hrefFor(page + 1)} label={t('nextPage')}>
          →
        </PageLink>
      )}
    </nav>
  );
}
