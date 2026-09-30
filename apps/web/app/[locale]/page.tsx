import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  getCategoryTree,
  getCities,
  getHomeDiscovery,
  getRecentActivity,
} from '@/lib/api';
import { DEFAULT_CITY_SLUG } from '@/lib/constants';
import { buildMetadata, SITE_URL } from '@/lib/seo/metadata';
import { itemListJsonLd } from '@/lib/seo/json-ld';
import { JsonLd } from '@/components/seo/json-ld';
import { Link } from '@/i18n/navigation';
import { SearchBar } from '@/components/search/search-bar';
import { BusinessCard } from '@/components/business/business-card';
import { ActivityCard } from '@/components/business/activity-card';
import { ExploreByCity } from '@/components/business/explore-by-city';
import { categoryIcon } from '@/lib/utils/category-icons';
import type { BusinessSummary } from '@buisnez/shared';

export const revalidate = 600;

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  return buildMetadata({
    title: t('metaTitle'),
    description: t('metaDescription'),
    path: '/',
    locale,
  });
}

/** Horizontal-scroll row of BusinessCards — spec section 5 (Featured / Highly-rated). */
function DiscoveryRow({
  title,
  businesses,
}: {
  title: string;
  businesses: BusinessSummary[];
}): React.ReactElement | null {
  if (businesses.length === 0) {
    return null;
  }
  return (
    <section className="space-y-3">
      <h2 className="font-display text-h2">{title}</h2>
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        {businesses.map((business) => (
          <div key={business.id} className="w-64 shrink-0 sm:w-auto">
            <BusinessCard business={business} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function HomePage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);

  const [
    t,
    { data: discovery },
    { data: categories },
    { data: cities },
    { data: recentActivity },
  ] = await Promise.all([
    getTranslations('home'),
    getHomeDiscovery(),
    getCategoryTree(),
    getCities(),
    getRecentActivity(9),
  ]);

  const topCategories = [...categories]
    .sort((a, b) => a.order - b.order)
    .slice(0, 8);

  const featuredForJsonLd = [
    ...discovery.featured,
    ...discovery.trending,
  ].slice(0, 10);

  return (
    <div className="space-y-12 pb-12">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: t('metaTitle'),
          url: SITE_URL,
          potentialAction: {
            '@type': 'SearchAction',
            target: `${SITE_URL}/search?q={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        }}
      />
      {featuredForJsonLd.length > 0 && (
        <JsonLd data={itemListJsonLd(featuredForJsonLd)} />
      )}

      {/* Hero — docs/17-design-overhaul.md section 1. No licensed Lahore photo asset is available in
          this environment, so the "photo hero" ships as a brand-toned gradient instead of an invented/
          unlicensed image URL — see docs/PROGRESS.md's design-overhaul entry. */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-900 via-emerald-700 to-emerald-500 px-4 py-16 text-center text-white sm:py-24">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]"
        />
        <div className="relative mx-auto max-w-3xl space-y-6">
          <h1 className="font-display text-display font-extrabold text-balance">
            {t('heroTitle')}
          </h1>
          <p className="text-white/85">{t('heroSubtitle')}</p>
          <SearchBar />
        </div>
      </section>

      <div className="container space-y-12">
        {recentActivity.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-h2">{t('recentActivity')}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentActivity.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="font-display text-h2">{t('popularCategories')}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {topCategories.map((category) => {
              const Icon = categoryIcon(category.icon);
              return (
                <Link
                  key={category.id}
                  href={`/${DEFAULT_CITY_SLUG}/${category.slug}`}
                  className="card-hover flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-5 text-center font-medium"
                >
                  <Icon
                    className="h-6 w-6 text-emerald-700"
                    aria-hidden="true"
                  />
                  {category.name}
                </Link>
              );
            })}
          </div>
        </section>

        <ExploreByCity cities={cities} defaultCitySlug={DEFAULT_CITY_SLUG} />

        <DiscoveryRow title={t('featured')} businesses={discovery.featured} />
        <DiscoveryRow
          title={t('highlyRated')}
          businesses={discovery.highlyRated}
        />

        {discovery.recent.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-h2">{t('recentlyReviewed')}</h2>
            <ul className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {discovery.recent.map((business) => (
                <li key={business.id}>
                  <Link
                    href={`/business/${business.slug}`}
                    className="text-sm text-foreground hover:text-emerald-700 hover:underline"
                  >
                    {business.name}
                  </Link>
                  <span className="text-muted-foreground">
                    {' '}
                    · {business.city.name}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
