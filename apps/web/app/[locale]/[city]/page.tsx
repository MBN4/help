import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  ApiError,
  getCategoryTree,
  getCity,
  searchBusinesses,
} from '@/lib/api';
import { buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbListJsonLd } from '@/lib/seo/json-ld';
import { JsonLd } from '@/components/seo/json-ld';
import { Link } from '@/i18n/navigation';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { BusinessListItem } from '@/components/business/business-list-item';

export const revalidate = 600;

interface PageProps {
  params: Promise<{ locale: string; city: string }>;
}

async function loadCity(citySlug: string) {
  try {
    return await getCity(citySlug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, city: citySlug } = await params;
  const [t, { data: city }] = await Promise.all([
    getTranslations({ locale, namespace: 'city' }),
    loadCity(citySlug),
  ]);
  return buildMetadata({
    title: t('metaTitle', { city: city.name }),
    description: t('metaDescription', { city: city.name }),
    path: `/${citySlug}`,
    locale,
  });
}

export default async function CityHubPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { locale, city: citySlug } = await params;
  setRequestLocale(locale);

  const [t, breadcrumbT, { data: city }, { data: categories }] =
    await Promise.all([
      getTranslations('city'),
      getTranslations('breadcrumb'),
      loadCity(citySlug),
      getCategoryTree(),
    ]);

  const { data: topBusinesses } = await searchBusinesses({
    city: citySlug,
    sort: 'rating',
    perPage: 12,
  });

  const breadcrumbItems = [
    { label: breadcrumbT('home'), href: '/' },
    { label: city.name },
  ];

  return (
    <div className="container space-y-8 py-6">
      <Breadcrumb items={breadcrumbItems} />
      <JsonLd
        data={breadcrumbListJsonLd(
          breadcrumbItems.map((item) => ({
            label: item.label,
            href: item.href ?? `/${citySlug}`,
          })),
        )}
      />

      <section className="space-y-2">
        <h1 className="text-3xl font-bold">{city.name}</h1>
        <p className="text-muted-foreground">
          {t('intro', { city: city.name })}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">
          {t('browseCategories', { city: city.name })}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/${citySlug}/${category.slug}`}
              className="rounded-lg border border-border bg-card p-4 text-center font-medium transition-[background-color,box-shadow] duration-[var(--motion-duration)] hover:bg-saffron-100 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {category.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">
          {t('topBusinesses', { city: city.name })}
        </h2>
        <div className="space-y-3">
          {topBusinesses.map((business, index) => (
            <BusinessListItem
              key={business.id}
              business={business}
              rank={index + 1}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
