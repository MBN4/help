import { z } from 'zod';
import { dayOfWeekSchema, priceTierSchema } from '../enums';
import { geoPointSchema } from './locations';
import { categoryRefSchema } from './categories';
import {
  businessAggregatesSchema,
  businessFeatureSchema,
  businessHoursEntrySchema,
  businessServiceSchema,
} from './business';

const locationRefSchema = z.object({ name: z.string(), slug: z.string() });

export const businessStatusSchema = z.enum([
  'PENDING',
  'PUBLISHED',
  'REJECTED',
  'SUSPENDED',
]);
export type BusinessStatusValue = z.infer<typeof businessStatusSchema>;

export const businessOwnerSummarySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  status: businessStatusSchema,
  averageRating: z.number().nullable(),
  reviewCount: z.number().int(),
  createdAt: z.string(),
});
export type BusinessOwnerSummary = z.infer<typeof businessOwnerSummarySchema>;

/** Full "manage" view for an owner/admin — mirrors `businessProfileSchema` plus status/ownerId and ALL services. */
export const businessManageProfileSchema = z.object({
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
  status: businessStatusSchema,
  ownerId: z.string().uuid().nullable(),
  category: categoryRefSchema.extend({ parent: categoryRefSchema.nullable() }),
  province: locationRefSchema,
  city: locationRefSchema,
  area: locationRefSchema.nullable(),
  hours: z.array(businessHoursEntrySchema),
  isOpenNow: z.boolean(),
  features: z.array(businessFeatureSchema),
  aggregates: businessAggregatesSchema,
  services: z.array(businessServiceSchema),
  createdAt: z.string(),
});
export type BusinessManageProfile = z.infer<typeof businessManageProfileSchema>;

export const updateBusinessInfoRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    categoryId: z.string().uuid().optional(),
    phone: z.string().trim().max(30).optional(),
    whatsapp: z.string().trim().max(30).optional(),
    email: z.string().trim().email().optional(),
    website: z.string().trim().url().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });
export type UpdateBusinessInfoRequest = z.infer<
  typeof updateBusinessInfoRequestSchema
>;

export const businessHoursUpdateSchema = z
  .array(
    z.object({
      dayOfWeek: dayOfWeekSchema,
      opensAt: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .nullable(),
      closesAt: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .nullable(),
      isClosed: z.boolean(),
    }),
  )
  .length(7)
  .refine(
    (value) => {
      const days = new Set(value.map((entry) => entry.dayOfWeek));
      return (
        days.size === 7 &&
        [
          'MONDAY',
          'TUESDAY',
          'WEDNESDAY',
          'THURSDAY',
          'FRIDAY',
          'SATURDAY',
          'SUNDAY',
        ].every((day) => days.has(day as (typeof value)[number]['dayOfWeek']))
      );
    },
    { message: 'All 7 days of the week must be present exactly once' },
  );
export type BusinessHoursUpdate = z.infer<typeof businessHoursUpdateSchema>;

export const businessFeaturesUpdateSchema = z.object({
  featureIds: z.array(z.string().uuid()),
});
export type BusinessFeaturesUpdate = z.infer<
  typeof businessFeaturesUpdateSchema
>;

export const businessLocationUpdateSchema = z.object({
  lat: z.number().min(20).max(40),
  lng: z.number().min(60).max(80),
});
export type BusinessLocationUpdate = z.infer<
  typeof businessLocationUpdateSchema
>;
