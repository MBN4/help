import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BadgeCheck, Phone, Globe, MessageCircle } from 'lucide-react';
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
import { PhotoMosaic } from '@/components/photo/photo-mosaic';
import { ProfileTabs } from '@/components/business/profile-tabs';
import { RatingSummary } from '@/components/business/rating-summary';
import { Badge } from '@/components/ui/badge';
import { ReviewList } from '@/components/review/review-list';
import { ReviewSection } from '@/components/review/review-section';
import { BusinessCard } from '@/components/business/business-card';
import { ReportButton } from '@/components/report/report-button';
import { SuggestEditButton } from '@/components/business/suggest-edit-button';
import { ClaimBusinessButton } from '@/components/business-owner/claim-business-button';
import { BusinessProfileActions } from '@/components/business/business-profile-actions';
import { ServicesMenu } from '@/components/business/services-menu';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { LazyMapView } from '@/components/map/lazy-map-view';
import { TrackEvent } from '@/components/analytics/track-event';

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

  const [t, breadcrumbT, { data: business }] = await Promise.all([
    getTranslations('business'),
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
    <div className="container space-y-6 py-6">
      <TrackEvent
        event="business viewed"
        properties={{ businessId: business.id, slug: business.slug }}
      />
      <Breadcrumb items={breadcrumbItems} />
      <JsonLd data={breadcrumbListJsonLd(breadcrumbLinks)} />
      <JsonLd data={localBusinessJsonLd(business, photos[0]?.url)} />
      {reviews.length > 0 && <JsonLd data={reviewsJsonLd(business, reviews)} />}

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">
            {business.name}
          </h1>
          {business.isClaimed && (
            <Badge variant="outline" className="gap-1">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {t('claimed')}
            </Badge>
          )}
          <div className="ms-auto flex items-center gap-2">
            <SuggestEditButton businessId={business.id} />
            <ReportButton targetType="BUSINESS" targetId={business.id} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RatingStars rating={business.aggregates.averageRating} size="md" />
          {business.aggregates.averageRating !== null && (
            <span className="font-semibold text-ink">
              {business.aggregates.averageRating.toFixed(1)}
            </span>
          )}
          <span className="text-sm text-muted-foreground">
            ({business.aggregates.reviewCount}{' '}
            {t('reviewsHeading').toLowerCase()})
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>
            {business.category.name}
            {business.category.parent
              ? ` · ${business.category.parent.name}`
              : ''}
          </span>
          <PriceLevel tier={business.priceTier} />
          <OpenNowBadge isOpenNow={business.isOpenNow} />
        </div>
        {!business.isClaimed && (
          <ClaimBusinessButton
            businessId={business.id}
            isClaimed={business.isClaimed}
          />
        )}
      </header>

      <PhotoMosaic photos={photos} businessName={business.name} />

      <BusinessProfileActions
        businessId={business.id}
        name={business.name}
        phone={business.phone}
        directionsHref={directionsHref}
      />

      <ProfileTabs
        label={t('jumpToSection')}
        tabs={[
          { id: 'overview', label: t('overview') },
          ...(business.services.some((s) => s.isAvailable)
            ? [{ id: 'services', label: t('servicesMenu') }]
            : []),
          { id: 'location', label: t('locationAndHours') },
          { id: 'reviews', label: t('reviewsHeading') },
          ...(photos.length > 0 ? [{ id: 'photos', label: t('photos') }] : []),
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section id="overview" className="scroll-mt-48 space-y-2">
            <h2 className="font-display text-h2">{t('aboutTitle')}</h2>
            <p className="text-foreground/90">
              {business.description ?? t('noDescription')}
            </p>
          </section>

          {business.features.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-display text-h2">{t('features')}</h2>
              <FeatureList features={business.features} />
            </section>
          )}

          <ServicesMenu services={business.services} />

          <section id="reviews" className="scroll-mt-48 space-y-4">
            <h2 className="font-display text-h2">{t('reviewsHeading')}</h2>
            <RatingSummary aggregates={business.aggregates} />
            <ReviewSection business={business} />
            {reviews.length === 0 ? (
              <p className="text-muted-foreground">{t('noReviews')}</p>
            ) : (
              <ReviewList businessId={business.id} reviews={reviews} />
            )}
          </section>

          {photos.length > 0 && (
            <section id="photos" className="scroll-mt-48 space-y-3">
              <h2 className="font-display text-h2">{t('photos')}</h2>
              <PhotoGallery photos={photos} businessName={business.name} />
            </section>
          )}

          {similar.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-h2">{t('similar')}</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {similar.map((item) => (
                  <BusinessCard key={item.id} business={item} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-44 lg:h-fit">
          <Card id="location" className="scroll-mt-48">
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

              <Separator />

              {business.phone && (
                <a
                  href={toTelHref(business.phone) ?? undefined}
                  className="flex items-center gap-2 text-sm hover:text-brand-700"
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
                  className="flex items-center gap-2 text-sm hover:text-brand-700"
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
                  className="flex items-center gap-2 truncate text-sm hover:text-brand-700"
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
