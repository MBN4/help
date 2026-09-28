import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getCategoryTree, getCities, getHomeDiscovery } from '@/lib/api';
import { DEFAULT_CITY_SLUG } from '@/lib/constants';
import { buildMetadata, SITE_URL } from '@/lib/seo/metadata';
import { itemListJsonLd } from '@/lib/seo/json-ld';
import { JsonLd } from '@/components/seo/json-ld';
import { Link } from '@/i18n/navigation';
import { SearchBar } from '@/components/search/search-bar';
import { BusinessCard } from '@/components/business/business-card';
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

function DiscoverySection({
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
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {businesses.map((business) => (
          <BusinessCard key={business.id} business={business} />
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

  const [t, { data: discovery }, { data: categories }, { data: cities }] =
    await Promise.all([
      getTranslations('home'),
      getHomeDiscovery(),
      getCategoryTree(),
      getCities(),
    ]);

  const orderedCities = [...cities].sort((a, b) => {
    if (a.slug === DEFAULT_CITY_SLUG) return -1;
    if (b.slug === DEFAULT_CITY_SLUG) return 1;
    return 0;
  });

  const featuredForJsonLd = [
    ...discovery.featured,
    ...discovery.trending,
  ].slice(0, 10);

  return (
    <div className="container space-y-10 py-8">
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
      <section className="space-y-4 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">{t('heroTitle')}</h1>
        <p className="text-muted-foreground">{t('heroSubtitle')}</p>
        <div className="mx-auto max-w-3xl">
          <SearchBar />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">{t('popularCategories')}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {categories.slice(0, 10).map((category) => (
            <Link
              key={category.id}
              href={`/${DEFAULT_CITY_SLUG}/${category.slug}`}
              className="rounded-lg border border-border bg-card p-4 text-center font-medium transition-colors hover:border-primary hover:text-primary"
            >
              {category.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">{t('popularCities')}</h2>
        <div className="flex flex-wrap gap-2">
          {orderedCities.slice(0, 10).map((city) => (
            <Link
              key={city.id}
              href={`/${city.slug}`}
              className="rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
            >
              {city.name}
            </Link>
          ))}
        </div>
      </section>

      <DiscoverySection title={t('trending')} businesses={discovery.trending} />
      <DiscoverySection
        title={t('highlyRated')}
        businesses={discovery.highlyRated}
      />
      <DiscoverySection title={t('featured')} businesses={discovery.featured} />
      <DiscoverySection
        title={t('recentlyAdded')}
        businesses={discovery.recent}
      />
    </div>
  );
}
