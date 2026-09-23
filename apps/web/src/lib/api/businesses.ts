import { z } from 'zod';
import {
  businessProfileSchema,
  businessPhotoSchema,
  businessReviewSchema,
  businessSummarySchema,
  type BusinessSearchQuery,
} from '@buisnez/shared';
import { apiRequest } from './client';

export type SearchBusinessesParams = Partial<BusinessSearchQuery>;

export async function searchBusinesses(params: SearchBusinessesParams = {}) {
  return apiRequest('/businesses', z.array(businessSummarySchema), {
    query: {
      q: params.q,
      category: params.category,
      province: params.province,
      city: params.city,
      area: params.area,
      minRating: params.minRating,
      priceLevel: params.priceLevel?.join(','),
      features: params.features?.join(','),
      openNow: params.openNow,
      lat: params.lat,
      lng: params.lng,
      radius: params.radius,
      sort: params.sort,
      page: params.page,
      perPage: params.perPage,
    },
  });
}

export async function getBusiness(slug: string) {
  return apiRequest(
    `/businesses/${encodeURIComponent(slug)}`,
    businessProfileSchema,
  );
}

export async function getBusinessReviews(id: string, page = 1, perPage = 20) {
  return apiRequest(
    `/businesses/${encodeURIComponent(id)}/reviews`,
    z.array(businessReviewSchema),
    {
      query: { page, perPage },
    },
  );
}

export async function getBusinessPhotos(id: string, page = 1, perPage = 20) {
  return apiRequest(
    `/businesses/${encodeURIComponent(id)}/photos`,
    z.array(businessPhotoSchema),
    {
      query: { page, perPage },
    },
  );
}

export async function getSimilarBusinesses(slug: string) {
  return apiRequest(
    `/businesses/${encodeURIComponent(slug)}/similar`,
    z.array(businessSummarySchema),
  );
}
