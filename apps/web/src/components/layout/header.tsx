import { Search } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getCategoryTree, getCities } from '@/lib/api';
import { DEFAULT_CITY_SLUG } from '@/lib/constants';
import { HeaderShell } from './header-shell';
import { LocationPicker } from './location-picker';
import { UserMenu } from './user-menu';
import { CategoryBar } from './category-bar';
import { SearchBar } from '@/components/search/search-bar';

export async function Header(): Promise<React.ReactElement> {
  const [t, { data: cities }, { data: categories }] = await Promise.all([
    getTranslations('nav'),
    getCities(),
    getCategoryTree(),
  ]);

  return (
    <HeaderShell>
      <div className="container flex h-16 items-center gap-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-0.5 font-display text-xl font-bold tracking-tight text-ink"
        >
          Buisnez
          <span className="text-saffron-600">.</span>
        </Link>

        <div className="hidden flex-1 md:flex md:max-w-2xl">
          <SearchBar variant="header" />
        </div>

        <div className="ms-auto hidden items-center gap-4 text-sm font-medium md:flex">
          <Link
            href="/account/businesses"
            className="whitespace-nowrap text-ink/80 hover:text-ink"
          >
            {t('forBusiness')}
          </Link>
          <Link
            href="/search"
            className="whitespace-nowrap text-ink/80 hover:text-ink"
          >
            {t('writeReview')}
          </Link>
          <LocationPicker cities={cities} />
          <UserMenu />
        </div>

        <Link
          href="/search"
          className="ms-auto flex h-9 w-9 items-center justify-center rounded-full border border-border md:hidden"
          aria-label={t('search')}
        >
          <Search className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="border-t border-border px-4 py-1 md:hidden">
        <LocationPicker cities={cities} />
      </div>

      <div className="border-t border-border">
        <CategoryBar categories={categories} citySlug={DEFAULT_CITY_SLUG} />
      </div>
    </HeaderShell>
  );
}
