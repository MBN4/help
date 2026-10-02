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
import { ListingWithMap } from '@/components/business/listing-with-map';
import { categoryIcon } from '@/lib/utils/category-icons';

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

      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 via-brand-700 to-brand-600 px-6 py-10 text-white sm:px-10 sm:py-14">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]"
        />
        <div className="relative space-y-2">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            {city.name}
          </h1>
          <p className="max-w-xl text-lg text-white/85">
            {t('intro', { city: city.name })}
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-bold">
          {t('browseCategories', { city: city.name })}
        </h2>
        <div className="grid grid-cols-3 gap-x-2 gap-y-6 sm:grid-cols-5 lg:grid-cols-10">
          {categories.map((category) => {
            const Icon = categoryIcon(category.icon);
            return (
              <Link
                key={category.id}
                href={`/${citySlug}/${category.slug}`}
                className="group flex flex-col items-center gap-2 text-center text-sm font-medium text-ink focus-visible:outline-none"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-white text-ink/80 shadow-sm transition-[transform,box-shadow,background-color,color] duration-[var(--motion-duration)] ease-out group-hover:-translate-y-0.5 group-hover:bg-brand-100 group-hover:text-brand-700 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring motion-reduce:transform-none">
                  <Icon className="h-7 w-7" aria-hidden="true" />
                </span>
                <span className="group-hover:underline group-hover:decoration-brand-500 group-hover:decoration-2 group-hover:underline-offset-4">
                  {category.name}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-bold">
          {t('topBusinesses', { city: city.name })}
        </h2>
        <ListingWithMap businesses={topBusinesses}>
          {topBusinesses.map((business, index) => (
            <BusinessListItem
              key={business.id}
              business={business}
              rank={index + 1}
            />
          ))}
        </ListingWithMap>
      </section>
    </div>
  );
}
