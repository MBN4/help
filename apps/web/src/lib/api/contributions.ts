import { z } from 'zod';
import {
  businessReviewSchema,
  businessSummarySchema,
  editSuggestionSchema,
  myPhotoSchema,
  myReviewSchema,
  presignPhotoResponseSchema,
  toggleFavoriteResponseSchema,
  toggleHelpfulResponseSchema,
  uploadedPhotoSchema,
  type ConfirmPhotoRequest,
  type CreateAppealRequest,
  type CreateEditSuggestionRequest,
  type CreateReportRequest,
  type CreateReviewRequest,
  type PresignPhotoRequest,
} from '@buisnez/shared';
import { apiRequest } from './client';

export async function createOrUpdateReview(
  businessId: string,
  body: CreateReviewRequest,
) {
  return apiRequest(
    `/businesses/${encodeURIComponent(businessId)}/review`,
    businessReviewSchema,
    {
      method: 'PUT',
      body,
    },
  );
}

export async function getMyReview(businessId: string) {
  return apiRequest(
    `/businesses/${encodeURIComponent(businessId)}/review/mine`,
    businessReviewSchema.nullable(),
  );
}

export async function toggleHelpful(reviewId: string) {
  return apiRequest(
    `/reviews/${encodeURIComponent(reviewId)}/helpful`,
    toggleHelpfulResponseSchema,
    {
      method: 'POST',
    },
  );
}

export async function getMyHelpfulVotes(businessId: string) {
  return apiRequest('/reviews/helpful-votes/mine', z.array(z.string()), {
    query: { businessId },
  });
}

export async function toggleFavorite(businessId: string) {
  return apiRequest('/favorites/toggle', toggleFavoriteResponseSchema, {
    method: 'POST',
    body: { businessId },
  });
}

export async function getMyFavorites(page = 1, perPage = 20) {
  return apiRequest('/favorites/mine', z.array(businessSummarySchema), {
    query: { page, perPage },
  });
}

export async function getMyFavoriteIds() {
  return apiRequest('/favorites/mine/ids', z.array(z.string()));
}

export async function createReport(body: CreateReportRequest) {
  return apiRequest('/reports', z.object({ id: z.string() }), {
    method: 'POST',
    body,
  });
}

export async function createAppeal(body: CreateAppealRequest) {
  return apiRequest('/reports/appeal', z.object({ id: z.string() }), {
    method: 'POST',
    body,
  });
}

export async function suggestBusinessEdit(
  businessId: string,
  body: CreateEditSuggestionRequest,
) {
  return apiRequest(
    `/businesses/${encodeURIComponent(businessId)}/suggest-edit`,
    z.object({ id: z.string() }),
    { method: 'POST', body },
  );
}

export async function getMyBusinessEditSuggestions(businessId: string) {
  return apiRequest(
    `/businesses/${encodeURIComponent(businessId)}/manage/edit-suggestions`,
    z.array(editSuggestionSchema),
  );
}

export async function presignPhotoUpload(body: PresignPhotoRequest) {
  return apiRequest('/photos/presign', presignPhotoResponseSchema, {
    method: 'POST',
    body,
  });
}

export async function confirmPhotoUpload(body: ConfirmPhotoRequest) {
  return apiRequest('/photos/confirm', uploadedPhotoSchema, {
    method: 'POST',
    body,
  });
}

export async function getMyReviews(page = 1, perPage = 20) {
  return apiRequest('/users/me/reviews', z.array(myReviewSchema), {
    query: { page, perPage },
  });
}

export async function getMyPhotos(page = 1, perPage = 20) {
  return apiRequest('/users/me/photos', z.array(myPhotoSchema), {
    query: { page, perPage },
  });
}
