import { z } from 'zod';
import { dayOfWeekSchema, priceTierSchema } from '../enums';
import { geoPointSchema } from './locations';
import { categoryRefSchema } from './categories';

const locationRefSchema = z.object({ name: z.string(), slug: z.string() });

export const businessSummarySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  priceTier: priceTierSchema.nullable(),
  isVerified: z.boolean(),
  category: locationRefSchema,
  city: locationRefSchema,
  area: locationRefSchema.nullable(),
  averageRating: z.number().nullable(),
  reviewCount: z.number().int(),
  thumbnailUrl: z.string().nullable(),
  distanceMeters: z.number().nullable(),
  isOpenNow: z.boolean(),
  location: geoPointSchema.nullable(),
});
export type BusinessSummary = z.infer<typeof businessSummarySchema>;

export const businessHoursEntrySchema = z.object({
  dayOfWeek: dayOfWeekSchema,
  opensAt: z.string().nullable(),
  closesAt: z.string().nullable(),
  isClosed: z.boolean(),
});
export type BusinessHoursEntry = z.infer<typeof businessHoursEntrySchema>;

export const businessFeatureSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  icon: z.string().nullable(),
});
export type BusinessFeatureRef = z.infer<typeof businessFeatureSchema>;

export const ratingBreakdownSchema = z.object({
  1: z.number().int(),
  2: z.number().int(),
  3: z.number().int(),
  4: z.number().int(),
  5: z.number().int(),
});
export type RatingBreakdown = z.infer<typeof ratingBreakdownSchema>;

export const businessAggregatesSchema = z.object({
  averageRating: z.number().nullable(),
  reviewCount: z.number().int(),
  ratingBreakdown: ratingBreakdownSchema,
});
export type BusinessAggregates = z.infer<typeof businessAggregatesSchema>;

/** Public read shape for a business's services — only `isAvailable: true` rows are ever exposed here. */
export const businessServiceSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  priceInPaisa: z.number().int().nullable(),
  isAvailable: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
});
export type BusinessServiceItem = z.infer<typeof businessServiceSchema>;

export const createBusinessServiceRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  priceInPaisa: z.number().int().min(0).optional(),
  isAvailable: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
export type CreateBusinessServiceRequest = z.infer<
  typeof createBusinessServiceRequestSchema
>;

export const updateBusinessServiceRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    priceInPaisa: z.number().int().min(0).optional(),
    isAvailable: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });
export type UpdateBusinessServiceRequest = z.infer<
  typeof updateBusinessServiceRequestSchema
>;

export const businessProfileSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  addressLine: z.string(),
  location: geoPointSchema.nullable(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  priceTier: priceTierSchema.nullable(),
  isVerified: z.boolean(),
  category: categoryRefSchema.extend({ parent: categoryRefSchema.nullable() }),
  province: locationRefSchema,
  city: locationRefSchema,
  area: locationRefSchema.nullable(),
  hours: z.array(businessHoursEntrySchema),
  isOpenNow: z.boolean(),
  features: z.array(businessFeatureSchema),
  aggregates: businessAggregatesSchema,
  services: z.array(businessServiceSchema),
  isClaimed: z.boolean(),
  createdAt: z.string(),
});
export type BusinessProfile = z.infer<typeof businessProfileSchema>;

/** Category-specific sub-rating dimensions, e.g. `{ food: 4, service: 5 }` — see docs/11-reviews-trust-safety.md. */
export const subRatingsSchema = z.record(
  z.string(),
  z.number().int().min(1).max(5),
);
export type SubRatings = z.infer<typeof subRatingsSchema>;

export const businessReviewSchema = z.object({
  id: z.string().uuid(),
  rating: z.number().int(),
  subRatings: subRatingsSchema.nullable(),
  title: z.string().nullable(),
  body: z.string().nullable(),
  userId: z.string().uuid(),
  userName: z.string(),
  userAvatarUrl: z.string().nullable(),
  ownerReply: z.string().nullable(),
  ownerReplyAt: z.string().nullable(),
  createdAt: z.string(),
  photoUrls: z.array(z.string()),
  helpfulCount: z.number().int(),
});
export type BusinessReview = z.infer<typeof businessReviewSchema>;

export const businessPhotoSchema = z.object({
  // Not `.uuid()`: seed data uses deterministic string ids (e.g. `photo-<slug>-gallery`) for idempotent upserts.
  id: z.string(),
  url: z.string(),
  thumbUrl: z.string().nullable(),
  cardUrl: z.string().nullable(),
  caption: z.string().nullable(),
  createdAt: z.string(),
});
export type BusinessPhoto = z.infer<typeof businessPhotoSchema>;

export const homeDiscoverySchema = z.object({
  trending: z.array(businessSummarySchema),
  highlyRated: z.array(businessSummarySchema),
  featured: z.array(businessSummarySchema),
  recent: z.array(businessSummarySchema),
});
export type HomeDiscovery = z.infer<typeof homeDiscoverySchema>;
