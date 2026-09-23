import type {
  BusinessProfile,
  BusinessReview,
  BusinessSummary,
} from '@buisnez/shared';
import { SITE_URL } from './metadata';

const PRICE_SYMBOL: Record<string, string> = {
  ONE: '$',
  TWO: '$$',
  THREE: '$$$',
  FOUR: '$$$$',
};

export function businessUrl(slug: string): string {
  return `${SITE_URL}/business/${slug}`;
}

export interface BreadcrumbLinkItem {
  label: string;
  href: string;
}

export function breadcrumbListJsonLd(
  items: BreadcrumbLinkItem[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: `${SITE_URL}${item.href}`,
    })),
  };
}

export function itemListJsonLd(
  businesses: BusinessSummary[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: businesses.map((business, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: businessUrl(business.slug),
      name: business.name,
    })),
  };
}

function aggregateRatingJsonLd(
  business: BusinessProfile,
): Record<string, unknown> | undefined {
  if (
    business.aggregates.reviewCount === 0 ||
    business.aggregates.averageRating === null
  ) {
    return undefined;
  }
  return {
    '@type': 'AggregateRating',
    ratingValue: business.aggregates.averageRating,
    reviewCount: business.aggregates.reviewCount,
    bestRating: 5,
    worstRating: 1,
  };
}

export function localBusinessJsonLd(
  business: BusinessProfile,
  imageUrl?: string | null,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: business.name,
    url: businessUrl(business.slug),
    image: imageUrl ?? undefined,
    description: business.description ?? undefined,
    telephone: business.phone ?? undefined,
    priceRange: business.priceTier
      ? PRICE_SYMBOL[business.priceTier]
      : undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: business.addressLine,
      addressLocality: business.city.name,
      addressRegion: business.province.name,
      addressCountry: 'PK',
    },
    geo: business.location
      ? {
          '@type': 'GeoCoordinates',
          latitude: business.location.lat,
          longitude: business.location.lng,
        }
      : undefined,
    aggregateRating: aggregateRatingJsonLd(business),
  };
}

export function reviewsJsonLd(
  business: BusinessProfile,
  reviews: BusinessReview[],
): Record<string, unknown>[] {
  return reviews.map((review) => ({
    '@context': 'https://schema.org',
    '@type': 'Review',
    itemReviewed: {
      '@type': 'LocalBusiness',
      name: business.name,
      url: businessUrl(business.slug),
    },
    author: { '@type': 'Person', name: review.userName },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: review.rating,
      bestRating: 5,
      worstRating: 1,
    },
    reviewBody: review.body ?? undefined,
    datePublished: review.createdAt,
  }));
}
