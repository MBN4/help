import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Phone, Globe, MessageCircle, Navigation } from 'lucide-react';
import { formatPhonePK, toTelHref } from '@buisnez/shared';
import {
  ApiError,
  getBusiness,
  getBusinessPhotos,
  getBusinessReviews,
  getSimilarBusinesses,
} from '@/lib/api';
import { buildMetadata } from '@/lib/seo/metadata';
import {
  breadcrumbListJsonLd,
  localBusinessJsonLd,
  reviewsJsonLd,
} from '@/lib/seo/json-ld';
import { JsonLd } from '@/components/seo/json-ld';
import {
  googleMapsDirectionsUrl,
  googleMapsDirectionsUrlForAddress,
} from '@/lib/utils/maps';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { RatingStars } from '@/components/business/rating-stars';
import { PriceLevel } from '@/components/business/price-level';
import { OpenNowBadge } from '@/components/business/open-now-badge';
import { FeatureList } from '@/components/business/feature-list';
import { HoursTable } from '@/components/business/hours-table';
import { PhotoGallery } from '@/components/photo/photo-gallery';
import { ReviewList } from '@/components/review/review-list';
import { ReviewSection } from '@/components/review/review-section';
import { BusinessCard } from '@/components/business/business-card';
import { FavoriteButton } from '@/components/business/favorite-button';
import { ReportButton } from '@/components/report/report-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { LazyMapView } from '@/components/map/lazy-map-view';

export const revalidate = 600;

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

async function loadBusiness(slug: string) {
  try {
    return await getBusiness(slug);
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
  const { locale, slug } = await params;
  const { data: business } = await loadBusiness(slug);
  const title = `${business.name} — ${business.category.name} in ${business.city.name}`;
  const description =
    business.description ??
    `${business.name} is a ${business.category.name.toLowerCase()} in ${business.city.name}, Pakistan on Buisnez.`;

  return buildMetadata({
    title,
    description,
    path: `/business/${slug}`,
    locale,
  });
}

export default async function BusinessProfilePage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const [t, commonT, breadcrumbT, { data: business }] = await Promise.all([
    getTranslations('business'),
    getTranslations('common'),
    getTranslations('breadcrumb'),
    loadBusiness(slug),
  ]);

  const [{ data: photos }, { data: reviews }, similar] = await Promise.all([
    getBusinessPhotos(business.id, 1, 20).catch(() => ({
      data: [],
      meta: null,
    })),
    getBusinessReviews(business.id, 1, 20).catch(() => ({
      data: [],
      meta: null,
    })),
    getSimilarBusinesses(slug)
      .then((result) => result.data)
      .catch(() => []),
  ]);

  const breadcrumbItems = [
    { label: breadcrumbT('home'), href: '/' },
    { label: business.city.name, href: `/${business.city.slug}` },
    {
      label: business.category.name,
      href: `/${business.city.slug}/${business.category.slug}`,
    },
    { label: business.name },
  ];
  const breadcrumbLinks = breadcrumbItems.map((item) => ({
    label: item.label,
    href: item.href ?? `/business/${slug}`,
  }));

  const directionsHref = business.location
    ? googleMapsDirectionsUrl(business.location.lat, business.location.lng)
    : googleMapsDirectionsUrlForAddress(
        `${business.addressLine}, ${business.city.name}`,
      );

  return (
    <div className="container space-y-8 py-6">
      <Breadcrumb items={breadcrumbItems} />
      <JsonLd data={breadcrumbListJsonLd(breadcrumbLinks)} />
      <JsonLd data={localBusinessJsonLd(business, photos[0]?.url)} />
      {reviews.length > 0 && <JsonLd data={reviewsJsonLd(business, reviews)} />}

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold">{business.name}</h1>
          <OpenNowBadge isOpenNow={business.isOpenNow} />
          <div className="ms-auto flex items-center gap-2">
            <FavoriteButton businessId={business.id} variant="full" />
            <ReportButton targetType="BUSINESS" targetId={business.id} />
          </div>
        </div>
        <p className="text-muted-foreground">
          {business.category.name}
          {business.category.parent
            ? ` · ${business.category.parent.name}`
            : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <RatingStars rating={business.aggregates.averageRating} size="md" />
          <span className="text-sm text-muted-foreground">
            {t('reviewsHeading')} ({business.aggregates.reviewCount})
          </span>
          <PriceLevel tier={business.priceTier} />
        </div>
      </header>

      <PhotoGallery photos={photos} businessName={business.name} />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section className="space-y-2">
            <h2 className="text-xl font-semibold">{t('aboutTitle')}</h2>
            <p className="text-foreground/90">
              {business.description ?? t('noDescription')}
            </p>
          </section>

          {business.features.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xl font-semibold">{t('features')}</h2>
              <FeatureList features={business.features} />
            </section>
          )}

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">{t('reviewsHeading')}</h2>
            <ReviewSection business={business} />
            {reviews.length === 0 ? (
              <p className="text-muted-foreground">{t('noReviews')}</p>
            ) : (
              <ReviewList businessId={business.id} reviews={reviews} />
            )}
          </section>

          {similar.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{t('similar')}</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {similar.map((item) => (
                  <BusinessCard key={item.id} business={item} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-4">
              {business.location && (
                <LazyMapView
                  center={business.location}
                  zoom={15}
                  markers={[
                    {
                      id: business.id,
                      lat: business.location.lat,
                      lng: business.location.lng,
                      title: business.name,
                    },
                  ]}
                />
              )}
              <p className="text-sm">{business.addressLine}</p>
              <Button asChild variant="outline" size="sm" className="w-full">
                <a
                  href={directionsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Navigation className="h-4 w-4" aria-hidden="true" />
                  {commonT('getDirections')}
                </a>
              </Button>

              <Separator />

              {business.phone && (
                <a
                  href={toTelHref(business.phone) ?? undefined}
                  className="flex items-center gap-2 text-sm hover:text-primary"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  {formatPhonePK(business.phone)}
                </a>
              )}
              {business.whatsapp && (
                <a
                  href={`https://wa.me/${business.whatsapp.replace('+', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm hover:text-primary"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  {formatPhonePK(business.whatsapp)}
                </a>
              )}
              {business.website && (
                <a
                  href={business.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 truncate text-sm hover:text-primary"
                >
                  <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{business.website}</span>
                </a>
              )}

              <Separator />

              <h2 className="text-sm font-semibold">{t('hours')}</h2>
              <HoursTable hours={business.hours} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
