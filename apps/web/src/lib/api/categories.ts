import { z } from 'zod';
import { categoryNodeSchema, categoryDetailSchema } from '@buisnez/shared';
import { apiRequest } from './client';

export async function getCategoryTree() {
  return apiRequest('/categories', z.array(categoryNodeSchema));
}

export async function getCategory(slug: string) {
  return apiRequest(
    `/categories/${encodeURIComponent(slug)}`,
    categoryDetailSchema,
  );
}
