import { homeDiscoverySchema } from '@buisnez/shared';
import { apiRequest } from './client';

export async function getHomeDiscovery() {
  return apiRequest('/discovery/home', homeDiscoverySchema);
}
