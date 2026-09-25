import { z } from 'zod';
import {
  businessManageProfileSchema,
  businessOwnerSummarySchema,
  businessReviewSchema,
  businessServiceSchema,
  uploadedPhotoSchema,
  type BusinessFeaturesUpdate,
  type BusinessHoursUpdate,
  type BusinessLocationUpdate,
  type ConfirmPhotoRequest,
  type CreateBusinessServiceRequest,
  type ReplyToReviewRequest,
  type UpdateBusinessInfoRequest,
  type UpdateBusinessServiceRequest,
} from '@buisnez/shared';
import { apiRequest } from './client';

export async function getMyOwnedBusinesses() {
  return apiRequest(
    '/businesses/owned/mine',
    z.array(businessOwnerSummarySchema),
  );
}

export async function getManageProfile(businessId: string) {
  return apiRequest(
    `/businesses/${encodeURIComponent(businessId)}/manage`,
    businessManageProfileSchema,
  );
}

export async function updateBusinessInfo(
  businessId: string,
  body: UpdateBusinessInfoRequest,
) {
  return apiRequest(
    `/businesses/${encodeURIComponent(businessId)}`,
    businessManageProfileSchema,
    { method: 'PATCH', body },
  );
}

export async function updateBusinessHours(
  businessId: string,
  body: BusinessHoursUpdate,
) {
  return apiRequest(
    `/businesses/${encodeURIComponent(businessId)}/hours`,
    businessManageProfileSchema,
    { method: 'PUT', body },
  );
}

export async function updateBusinessFeatures(
  businessId: string,
  body: BusinessFeaturesUpdate,
) {
  return apiRequest(
    `/businesses/${encodeURIComponent(businessId)}/features`,
    businessManageProfileSchema,
    { method: 'PUT', body },
  );
}

export async function updateBusinessLocation(
  businessId: string,
  body: BusinessLocationUpdate,
) {
  return apiRequest(
    `/businesses/${encodeURIComponent(businessId)}/location`,
    businessManageProfileSchema,
    { method: 'PATCH', body },
  );
}

export async function createBusinessService(
  businessId: string,
  body: CreateBusinessServiceRequest,
) {
  return apiRequest(
    `/businesses/${encodeURIComponent(businessId)}/services`,
    businessServiceSchema,
    { method: 'POST', body },
  );
}

export async function updateBusinessService(
  businessId: string,
  serviceId: string,
  body: UpdateBusinessServiceRequest,
) {
  return apiRequest(
    `/businesses/${encodeURIComponent(businessId)}/services/${encodeURIComponent(serviceId)}`,
    businessServiceSchema,
    { method: 'PATCH', body },
  );
}

export async function deleteBusinessService(
  businessId: string,
  serviceId: string,
) {
  return apiRequest(
    `/businesses/${encodeURIComponent(businessId)}/services/${encodeURIComponent(serviceId)}`,
    z.object({ deleted: z.literal(true) }),
    { method: 'DELETE' },
  );
}

export async function addBusinessPhoto(
  businessId: string,
  body: Omit<ConfirmPhotoRequest, 'businessId'>,
) {
  return apiRequest(
    `/businesses/${encodeURIComponent(businessId)}/photos`,
    uploadedPhotoSchema,
    { method: 'POST', body },
  );
}

export async function deleteBusinessPhoto(businessId: string, photoId: string) {
  return apiRequest(
    `/businesses/${encodeURIComponent(businessId)}/photos/${encodeURIComponent(photoId)}`,
    z.object({ deleted: z.literal(true) }),
    { method: 'DELETE' },
  );
}

export async function replyToReview(
  businessId: string,
  reviewId: string,
  body: ReplyToReviewRequest,
) {
  return apiRequest(
    `/businesses/${encodeURIComponent(businessId)}/reviews/${encodeURIComponent(reviewId)}/reply`,
    businessReviewSchema,
    { method: 'PUT', body },
  );
}

export async function deleteReviewReply(businessId: string, reviewId: string) {
  return apiRequest(
    `/businesses/${encodeURIComponent(businessId)}/reviews/${encodeURIComponent(reviewId)}/reply`,
    businessReviewSchema,
    { method: 'DELETE' },
  );
}
