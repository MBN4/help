import { z } from 'zod';
import { subRatingsSchema } from './business';

export const replyToReviewRequestSchema = z.object({
  reply: z.string().min(1).max(2000),
});
export type ReplyToReviewRequest = z.infer<typeof replyToReviewRequestSchema>;

export const createReviewRequestSchema = z.object({
  rating: z.number().int().min(1).max(5),
  subRatings: subRatingsSchema.optional(),
  title: z.string().trim().max(150).optional(),
  body: z.string().trim().max(5000).optional(),
  photoIds: z.array(z.string()).max(10).optional(),
});
export type CreateReviewRequest = z.infer<typeof createReviewRequestSchema>;

export const toggleFavoriteRequestSchema = z.object({
  businessId: z.string().uuid(),
});
export type ToggleFavoriteRequest = z.infer<typeof toggleFavoriteRequestSchema>;

export const toggleFavoriteResponseSchema = z.object({
  favorited: z.boolean(),
});
export type ToggleFavoriteResponse = z.infer<
  typeof toggleFavoriteResponseSchema
>;

export const toggleHelpfulResponseSchema = z.object({
  helpful: z.boolean(),
  helpfulCount: z.number().int(),
});
export type ToggleHelpfulResponse = z.infer<typeof toggleHelpfulResponseSchema>;

export const reportTargetTypeSchema = z.enum([
  'BUSINESS',
  'REVIEW',
  'PHOTO',
  'USER',
]);
export type ReportTargetTypeValue = z.infer<typeof reportTargetTypeSchema>;

export const reportReasonSchema = z.enum([
  'SPAM',
  'INAPPROPRIATE',
  'FAKE',
  'CLOSED',
  'DUPLICATE',
  'OTHER',
  /** Phase 8: content-owner appeal of a hold/removal — never client-selectable via `createReportRequestSchema`
   * below, only set server-side by the dedicated appeal endpoint. See docs/11-reviews-trust-safety.md. */
  'APPEAL',
]);
export type ReportReasonValue = z.infer<typeof reportReasonSchema>;

export const createReportRequestSchema = z.object({
  targetType: reportTargetTypeSchema,
  targetId: z.string().uuid(),
  reason: reportReasonSchema.exclude(['APPEAL']),
  message: z.string().trim().max(1000).optional(),
});
export type CreateReportRequest = z.infer<typeof createReportRequestSchema>;

export const createAppealRequestSchema = z.object({
  targetType: z.enum(['REVIEW', 'PHOTO']),
  targetId: z.string().uuid(),
  message: z.string().trim().max(1000).optional(),
});
export type CreateAppealRequest = z.infer<typeof createAppealRequestSchema>;

export const presignPhotoRequestSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});
export type PresignPhotoRequest = z.infer<typeof presignPhotoRequestSchema>;

export const presignPhotoResponseSchema = z.object({
  uploadUrl: z.string(),
  key: z.string(),
});
export type PresignPhotoResponse = z.infer<typeof presignPhotoResponseSchema>;

export const confirmPhotoRequestSchema = z.object({
  key: z.string().min(1),
  businessId: z.string().uuid().optional(),
  reviewId: z.string().uuid().optional(),
  caption: z.string().trim().max(200).optional(),
});
export type ConfirmPhotoRequest = z.infer<typeof confirmPhotoRequestSchema>;

export const uploadedPhotoSchema = z.object({
  id: z.string(),
  url: z.string(),
  thumbUrl: z.string().nullable(),
  cardUrl: z.string().nullable(),
  caption: z.string().nullable(),
  createdAt: z.string(),
});
export type UploadedPhoto = z.infer<typeof uploadedPhotoSchema>;

const businessRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
});

export const myReviewSchema = z.object({
  id: z.string().uuid(),
  business: businessRefSchema,
  rating: z.number().int(),
  subRatings: subRatingsSchema.nullable(),
  title: z.string().nullable(),
  body: z.string().nullable(),
  createdAt: z.string(),
  photoUrls: z.array(z.string()),
  helpfulCount: z.number().int(),
  status: z.enum(['PUBLISHED', 'PENDING', 'REMOVED']),
  moderationReason: z.string().nullable(),
});
export type MyReview = z.infer<typeof myReviewSchema>;

export const myPhotoSchema = z.object({
  id: z.string(),
  url: z.string(),
  thumbUrl: z.string().nullable(),
  cardUrl: z.string().nullable(),
  caption: z.string().nullable(),
  createdAt: z.string(),
  business: businessRefSchema.nullable(),
  status: z.enum(['PENDING', 'APPROVED', 'REMOVED']),
  moderationReason: z.string().nullable(),
});
export type MyPhoto = z.infer<typeof myPhotoSchema>;
