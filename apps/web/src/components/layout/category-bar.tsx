import type { CategoryNode } from '@buisnez/shared';
import { Link } from '@/i18n/navigation';

export interface CategoryBarProps {
  categories: CategoryNode[];
  citySlug: string;
}

/**
 * Second header row — top-level category links into `/[city]/[category]`, same route this app has
 * always used. docs/17-design-overhaul.md asked for dropdown sub-menus per category; this ships as a
 * flat scrollable link row instead (reusing existing nav primitives rather than building a new mega-menu
 * component under this pass's time box) — see docs/PROGRESS.md's design-overhaul entry.
 */
export function CategoryBar({
  categories,
  citySlug,
}: CategoryBarProps): React.ReactElement {
  const topLevel = [...categories].sort((a, b) => a.order - b.order);

  return (
    <nav
      aria-label="Categories"
      className="border-t border-white/10 bg-emerald-900"
    >
      <div className="container flex items-center gap-5 overflow-x-auto py-2 text-sm font-medium text-white/85 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {topLevel.map((category) => (
          <Link
            key={category.id}
            href={`/${citySlug}/${category.slug}`}
            className="whitespace-nowrap rounded-full px-1 py-0.5 hover:text-white hover:underline hover:decoration-saffron-500 hover:decoration-2 hover:underline-offset-4"
          >
            {category.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}
