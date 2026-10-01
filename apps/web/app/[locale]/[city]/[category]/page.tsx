import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ApiError, getCategory, getCity, searchBusinesses } from '@/lib/api';
import { buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbListJsonLd, itemListJsonLd } from '@/lib/seo/json-ld';
import { JsonLd } from '@/components/seo/json-ld';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { BusinessListItem } from '@/components/business/business-list-item';
import { Pagination } from '@/components/search/pagination';

export const revalidate = 600;

const PER_PAGE = 20;

interface PageProps {
  params: Promise<{ locale: string; city: string; category: string }>;
  searchParams: Promise<{ page?: string }>;
}

async function loadCityAndCategory(citySlug: string, categorySlug: string) {
  try {
    const [city, category] = await Promise.all([
      getCity(citySlug),
      getCategory(categorySlug),
    ]);
    return { city: city.data, category: category.data };
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
  const { locale, city: citySlug, category: categorySlug } = await params;
  const [t, { city, category }] = await Promise.all([
    getTranslations({ locale, namespace: 'cityCategory' }),
    loadCityAndCategory(citySlug, categorySlug),
  ]);
  return buildMetadata({
    title: t('metaTitle', { category: category.name, city: city.name }),
    description: t('metaDescription', {
      category: category.name,
      city: city.name,
    }),
    path: `/${citySlug}/${categorySlug}`,
    locale,
  });
}

export default async function CityCategoryPage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { locale, city: citySlug, category: categorySlug } = await params;
  const { page: pageParam } = await searchParams;
  setRequestLocale(locale);

  const page = Math.max(1, Number(pageParam) || 1);

  const [t, breadcrumbT, { city, category }] = await Promise.all([
    getTranslations('cityCategory'),
    getTranslations('breadcrumb'),
    loadCityAndCategory(citySlug, categorySlug),
  ]);

  const { data: businesses, meta } = await searchBusinesses({
    city: citySlug,
    category: categorySlug,
    sort: 'relevance',
    page,
    perPage: PER_PAGE,
  });

  const breadcrumbItems = [
    { label: breadcrumbT('home'), href: '/' },
    { label: city.name, href: `/${citySlug}` },
    { label: category.name },
  ];
  const breadcrumbLinks = breadcrumbItems.map((item) => ({
    label: item.label,
    href: item.href ?? `/${citySlug}/${categorySlug}`,
  }));

  const totalPages = meta
    ? Math.max(1, Math.ceil(meta.total / meta.perPage))
    : 1;

  return (
    <div className="container space-y-6 py-6">
      <Breadcrumb items={breadcrumbItems} />
      <JsonLd data={breadcrumbListJsonLd(breadcrumbLinks)} />
      <JsonLd data={itemListJsonLd(businesses)} />

      <section className="space-y-1">
        <h1 className="text-3xl font-bold">
          {t('heading', { category: category.name, city: city.name })}
        </h1>
        <p className="text-muted-foreground">
          {t('resultsSubtitle', {
            count: meta?.total ?? businesses.length,
            city: city.name,
          })}
        </p>
      </section>

      <div className="space-y-3">
        {businesses.map((business, index) => (
          <BusinessListItem
            key={business.id}
            business={business}
            rank={(page - 1) * PER_PAGE + index + 1}
          />
        ))}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        hrefFor={(n) => `/${citySlug}/${categorySlug}?page=${n}`}
      />
    </div>
  );
}
