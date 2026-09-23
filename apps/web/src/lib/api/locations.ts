import { z } from 'zod';
import {
  areaSummarySchema,
  citySummarySchema,
  cityDetailSchema,
  provinceSummarySchema,
} from '@buisnez/shared';
import { apiRequest } from './client';

export async function getProvinces() {
  return apiRequest('/locations/provinces', z.array(provinceSummarySchema));
}

export async function getCities(province?: string) {
  return apiRequest('/locations/cities', z.array(citySummarySchema), {
    query: { province },
  });
}

export async function getCity(slug: string) {
  return apiRequest(
    `/locations/cities/${encodeURIComponent(slug)}`,
    cityDetailSchema,
  );
}

export async function getAreas(city: string) {
  return apiRequest('/locations/areas', z.array(areaSummarySchema), {
    query: { city },
  });
}
