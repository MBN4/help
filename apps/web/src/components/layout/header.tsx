import { Search } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getCities } from '@/lib/api';
import { LocationPicker } from './location-picker';
import { UserMenu } from './user-menu';

export async function Header(): Promise<React.ReactElement> {
  const [t, { data: cities }] = await Promise.all([
    getTranslations('nav'),
    getCities(),
  ]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-16 items-center justify-between gap-3">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-1.5 text-lg font-bold text-primary"
        >
          Buisnez
        </Link>

        <div className="hidden sm:block">
          <LocationPicker cities={cities} />
        </div>

        <nav className="ms-auto hidden items-center gap-6 text-sm font-medium sm:flex">
          <Link href="/" className="hover:text-primary">
            {t('home')}
          </Link>
          <Link href="/search" className="hover:text-primary">
            {t('search')}
          </Link>
        </nav>

        <div className="hidden sm:block">
          <UserMenu />
        </div>

        <Link
          href="/search"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border sm:hidden"
          aria-label={t('search')}
        >
          <Search className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <div className="border-t border-border px-4 py-1.5 sm:hidden">
        <LocationPicker cities={cities} />
      </div>
    </header>
  );
}
