import { z } from 'zod';

export const listCitiesQuerySchema = z.object({
  province: z.string().min(1).optional(),
});
export type ListCitiesQuery = z.infer<typeof listCitiesQuerySchema>;

export const listAreasQuerySchema = z.object({
  city: z.string().min(1),
});
export type ListAreasQuery = z.infer<typeof listAreasQuerySchema>;

export const geoPointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});
export type GeoPoint = z.infer<typeof geoPointSchema>;

export const provinceSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  cityCount: z.number().int(),
});
export type ProvinceSummary = z.infer<typeof provinceSummarySchema>;

export const citySummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  provinceName: z.string(),
});
export type CitySummary = z.infer<typeof citySummarySchema>;

export const cityDetailSchema = citySummarySchema.extend({
  centroid: geoPointSchema.nullable(),
});
export type CityDetail = z.infer<typeof cityDetailSchema>;

export const areaSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
});
export type AreaSummary = z.infer<typeof areaSummarySchema>;
