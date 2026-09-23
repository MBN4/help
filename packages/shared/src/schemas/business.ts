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
  features: z.array(businessFeatureSchema),
  aggregates: businessAggregatesSchema,
  createdAt: z.string(),
});
export type BusinessProfile = z.infer<typeof businessProfileSchema>;

export const businessReviewSchema = z.object({
  id: z.string().uuid(),
  rating: z.number().int(),
  title: z.string().nullable(),
  body: z.string().nullable(),
  userName: z.string(),
  ownerReply: z.string().nullable(),
  ownerReplyAt: z.string().nullable(),
  createdAt: z.string(),
  photoUrls: z.array(z.string()),
});
export type BusinessReview = z.infer<typeof businessReviewSchema>;

export const businessPhotoSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
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
