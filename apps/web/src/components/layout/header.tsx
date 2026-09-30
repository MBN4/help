import { Search } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getCategoryTree, getCities } from '@/lib/api';
import { DEFAULT_CITY_SLUG } from '@/lib/constants';
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
    <header className="sticky top-0 z-40 bg-emerald-900 text-white shadow-sm">
      <div className="container flex h-16 items-center gap-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-1 font-display text-xl font-extrabold tracking-tight"
        >
          Buisnez
          <span className="text-saffron-500">.</span>
        </Link>

        <div className="hidden flex-1 md:flex md:max-w-2xl">
          <SearchBar variant="header" />
        </div>

        <div className="ms-auto hidden items-center gap-5 text-sm font-medium md:flex">
          <Link
            href="/account/businesses"
            className="whitespace-nowrap text-white/90 hover:text-white"
          >
            {t('forBusiness')}
          </Link>
          <Link
            href="/search"
            className="whitespace-nowrap text-white/90 hover:text-white"
          >
            {t('writeReview')}
          </Link>
          <LocationPicker cities={cities} onDark />
          <UserMenu />
        </div>

        <Link
          href="/search"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 md:hidden"
          aria-label={t('search')}
        >
          <Search className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="border-t border-white/10 px-4 py-1.5 md:hidden">
        <LocationPicker cities={cities} onDark />
      </div>

      <CategoryBar categories={categories} citySlug={DEFAULT_CITY_SLUG} />
    </header>
  );
}
