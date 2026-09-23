import { z } from 'zod';
import { businessFeatureSchema } from '@buisnez/shared';
import { apiRequest } from './client';

export async function getFeatures() {
  return apiRequest('/features', z.array(businessFeatureSchema));
}
