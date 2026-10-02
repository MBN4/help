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
          className="flex shrink-0 items-center gap-0.5 font-display text-xl font-bold tracking-tight text-ink group-data-[overlay=true]/hdr:text-white"
        >
          Buisnez
          <span className="text-brand-600">.</span>
        </Link>

        <div className="hidden flex-1 md:flex md:max-w-2xl">
          <SearchBar variant="header" />
        </div>

        <div className="ms-auto hidden items-center gap-4 text-sm font-medium md:flex">
          <Link
            href="/account/businesses"
            className="whitespace-nowrap text-ink/80 hover:text-ink group-data-[overlay=true]/hdr:text-white group-data-[overlay=true]/hdr:hover:text-white/80"
          >
            {t('forBusiness')}
          </Link>
          <Link
            href="/search"
            className="whitespace-nowrap text-ink/80 hover:text-ink group-data-[overlay=true]/hdr:text-white group-data-[overlay=true]/hdr:hover:text-white/80"
          >
            {t('writeReview')}
          </Link>
          <UserMenu />
        </div>

        <Link
          href="/search"
          className="ms-auto flex h-9 w-9 items-center justify-center rounded-full border border-border group-data-[overlay=true]/hdr:border-white/60 group-data-[overlay=true]/hdr:text-white md:hidden"
          aria-label={t('search')}
        >
          <Search className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="border-t border-border px-4 py-1 group-data-[overlay=true]/hdr:border-transparent md:hidden">
        <LocationPicker cities={cities} />
      </div>

      <div className="border-t border-border group-data-[overlay=true]/hdr:border-transparent">
        <CategoryBar categories={categories} citySlug={DEFAULT_CITY_SLUG} />
      </div>
    </HeaderShell>
  );
}
