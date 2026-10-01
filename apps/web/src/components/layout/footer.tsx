import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getCategoryTree, getCities } from '@/lib/api';
import { DEFAULT_CITY_SLUG } from '@/lib/constants';

export async function Footer(): Promise<React.ReactElement> {
  const [t, { data: cities }, { data: categories }] = await Promise.all([
    getTranslations('footer'),
    getCities(),
    getCategoryTree(),
  ]);
  const year = new Date().getFullYear();
  const topCategories = [...categories]
    .sort((a, b) => a.order - b.order)
    .slice(0, 8);

  return (
    <footer className="mt-12 border-t border-border bg-canvas pb-20 pt-12 sm:pb-12">
      <div className="container grid grid-cols-2 gap-8 text-sm sm:grid-cols-3 md:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <Link href="/" className="font-display text-lg font-bold text-ink">
            Buisnez<span className="text-saffron-600">.</span>
          </Link>
          <p className="mt-2 text-muted-foreground">{t('madeInPakistan')}</p>
        </div>

        <nav aria-label={t('about')} className="flex flex-col gap-2">
          <h2 className="font-display text-sm font-bold text-ink">
            {t('about')}
          </h2>
          <Link href="/" className="text-muted-foreground hover:text-ink">
            {t('howItWorks')}
          </Link>
          <Link href="/" className="text-muted-foreground hover:text-ink">
            {t('trustSafety')}
          </Link>
          <Link href="/" className="text-muted-foreground hover:text-ink">
            {t('help')}
          </Link>
        </nav>

        <nav aria-label={t('discover')} className="flex flex-col gap-2">
          <h2 className="font-display text-sm font-bold text-ink">
            {t('discover')}
          </h2>
          <Link href="/search" className="text-muted-foreground hover:text-ink">
            {t('writeReview')}
          </Link>
          {topCategories.slice(0, 4).map((category) => (
            <Link
              key={category.id}
              href={`/${DEFAULT_CITY_SLUG}/${category.slug}`}
              className="text-muted-foreground hover:text-ink"
            >
              {category.name}
            </Link>
          ))}
        </nav>

        <nav aria-label={t('forBusinesses')} className="flex flex-col gap-2">
          <h2 className="font-display text-sm font-bold text-ink">
            {t('forBusinesses')}
          </h2>
          <Link
            href="/account/businesses"
            className="text-muted-foreground hover:text-ink"
          >
            {t('claimBusiness')}
          </Link>
          <Link href="/" className="text-muted-foreground hover:text-ink">
            {t('advertise')}
          </Link>
        </nav>
      </div>

      <div className="container mt-8 border-t border-border pt-6">
        <h2 className="font-display text-sm font-bold text-ink">
          {t('browseCities')}
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {cities.map((city) => (
            <li key={city.id}>
              <Link
                href={`/${city.slug}`}
                className="text-muted-foreground hover:text-ink hover:underline"
              >
                {city.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="container mt-8 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="font-medium text-ink">{t('languages')}:</span>
          <span>{t('languageEnglish')}</span>
          <span>{t('languageUrduSoon')}</span>
          <span>{t('languageRomanUrduSoon')}</span>
        </div>
        <p>{t('copyright', { year })}</p>
      </div>
    </footer>
  );
}
