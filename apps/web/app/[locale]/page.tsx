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
import { HeroCarousel } from '@/components/home/hero-carousel';
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
    <div className="pb-12">
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

      <HeroCarousel />

      <div className="container space-y-12 pt-10">
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

        <section className="space-y-4">
          <h2 className="font-display text-h2">{t('popularCategories')}</h2>
          <div className="grid grid-cols-4 gap-x-2 gap-y-6 sm:grid-cols-8">
            {topCategories.map((category) => {
              const Icon = categoryIcon(category.icon);
              return (
                <Link
                  key={category.id}
                  href={`/${DEFAULT_CITY_SLUG}/${category.slug}`}
                  className="group flex flex-col items-center gap-2 text-center text-sm font-medium text-ink focus-visible:outline-none"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-white text-ink/80 shadow-sm transition-[transform,box-shadow,background-color,color] duration-[var(--motion-duration)] ease-out group-hover:-translate-y-0.5 group-hover:bg-saffron-100 group-hover:text-saffron-700 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring motion-reduce:transform-none">
                    <Icon className="h-7 w-7" aria-hidden="true" />
                  </span>
                  <span className="group-hover:underline group-hover:decoration-saffron-500 group-hover:decoration-2 group-hover:underline-offset-4">
                    {category.name}
                  </span>
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
                    className="text-sm text-foreground hover:text-saffron-700 hover:underline"
                  >
                    {business.name}
                  </Link>
                  <span className="text-sm text-muted-foreground">
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
