import { z } from 'zod';
import { priceTierSchema } from '../enums';
import { DEFAULT_PER_PAGE, MAX_PER_PAGE } from './pagination';

export const DEFAULT_SEARCH_RADIUS_METERS = 5000;

export const businessSortSchema = z.enum([
  'relevance',
  'rating',
  'distance',
  'reviews',
  'newest',
]);
export type BusinessSort = z.infer<typeof businessSortSchema>;

function commaSeparated(): z.ZodType<string[] | undefined, unknown> {
  return z.preprocess((value) => {
    if (typeof value !== 'string' || value.length === 0) {
      return undefined;
    }
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }, z.array(z.string()).optional());
}

function optionalBoolean(): z.ZodType<boolean | undefined, unknown> {
  return z.preprocess((value) => {
    if (value === undefined) {
      return undefined;
    }
    return value === 'true' || value === true;
  }, z.boolean().optional());
}

export const businessSearchQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(200).optional(),
    category: z.string().min(1).optional(),
    province: z.string().min(1).optional(),
    city: z.string().min(1).optional(),
    area: z.string().min(1).optional(),
    minRating: z.coerce.number().min(1).max(5).optional(),
    priceLevel: commaSeparated().pipe(z.array(priceTierSchema).optional()),
    features: commaSeparated(),
    openNow: optionalBoolean(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce
      .number()
      .positive()
      .max(200_000)
      .default(DEFAULT_SEARCH_RADIUS_METERS),
    sort: businessSortSchema.default('relevance'),
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_PER_PAGE)
      .default(DEFAULT_PER_PAGE),
  })
  .superRefine((value, ctx) => {
    if ((value.lat === undefined) !== (value.lng === undefined)) {
      ctx.addIssue({
        code: 'custom',
        message: 'lat and lng must both be provided together',
        path: ['lat'],
      });
    }
    if (
      value.sort === 'distance' &&
      (value.lat === undefined || value.lng === undefined)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'sort=distance requires lat and lng',
        path: ['sort'],
      });
    }
  });
export type BusinessSearchQuery = z.infer<typeof businessSearchQuerySchema>;
