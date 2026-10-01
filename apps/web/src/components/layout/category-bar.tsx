import { ChevronDown } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { CategoryNode } from '@buisnez/shared';
import { Link } from '@/i18n/navigation';

export interface CategoryBarProps {
  categories: CategoryNode[];
  citySlug: string;
}

/** Top-level categories shown inline on desktop; the rest go under "More". */
const INLINE_COUNT = 6;

const panelClass =
  'invisible absolute start-0 top-full z-50 min-w-56 translate-y-1 rounded-lg border border-border bg-white py-2 opacity-0 shadow-lg transition-[opacity,transform,visibility] duration-[var(--motion-duration-dropdown)] ease-out group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100';
const panelLinkClass =
  'block px-4 py-1.5 text-sm text-ink/80 hover:bg-brand-100 hover:text-ink focus-visible:bg-brand-100 focus-visible:outline-none';
const triggerClass =
  'flex items-center gap-1 whitespace-nowrap border-b-2 border-transparent py-3 text-sm font-medium text-ink/80 transition-colors hover:border-brand-500 hover:text-ink focus-visible:border-brand-500 focus-visible:outline-none group-focus-within:border-brand-500 group-hover:border-brand-500';

/**
 * Second header row. Below `lg` it is a flat scrollable link row (touch has no hover); from `lg` up each
 * top-level category opens a dropdown of its children on hover or keyboard focus (pure CSS, so it stays a
 * server component and the links remain crawlable). Same `/[city]/[category]` routes as always.
 */
export async function CategoryBar({
  categories,
  citySlug,
}: CategoryBarProps): Promise<React.ReactElement> {
  const t = await getTranslations('nav');
  const topLevel = [...categories].sort((a, b) => a.order - b.order);
  const inline = topLevel.slice(0, INLINE_COUNT);
  const overflow = topLevel.slice(INLINE_COUNT);
  const href = (slug: string): string => `/${citySlug}/${slug}`;

  return (
    <>
      <nav aria-label={t('categories')} className="hidden lg:block">
        <div className="container flex items-center gap-7">
          {inline.map((category) => (
            <div key={category.id} className="group relative">
              <Link href={href(category.slug)} className={triggerClass}>
                {category.name}
                {category.children.length > 0 && (
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </Link>
              {category.children.length > 0 && (
                <div className={panelClass}>
                  {category.children.map((child) => (
                    <Link
                      key={child.id}
                      href={href(child.slug)}
                      className={panelLinkClass}
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          {overflow.length > 0 && (
            <div className="group relative">
              <button type="button" className={triggerClass}>
                {t('moreCategories')}
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <div className={panelClass}>
                {overflow.map((category) => (
                  <Link
                    key={category.id}
                    href={href(category.slug)}
                    className={panelLinkClass}
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </nav>

      <nav aria-label={t('categories')} className="lg:hidden">
        <div className="container flex items-center gap-5 overflow-x-auto py-2 text-sm font-medium text-ink/80 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {topLevel.map((category) => (
            <Link
              key={category.id}
              href={href(category.slug)}
              className="whitespace-nowrap hover:text-ink hover:underline hover:decoration-brand-500 hover:decoration-2 hover:underline-offset-4"
            >
              {category.name}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
