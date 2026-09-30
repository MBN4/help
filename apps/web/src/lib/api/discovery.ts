import { homeDiscoverySchema, recentActivityItemSchema } from '@buisnez/shared';
import { z } from 'zod';
import { apiRequest } from './client';

export async function getHomeDiscovery() {
  return apiRequest('/discovery/home', homeDiscoverySchema);
}

export async function getRecentActivity(limit = 9) {
  return apiRequest(
    `/discovery/recent-activity?limit=${limit}`,
    z.array(recentActivityItemSchema),
  );
}
