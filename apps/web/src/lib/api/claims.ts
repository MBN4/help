import { z } from 'zod';
import {
  claimSchema,
  type Claim,
  type CreateClaimRequest,
} from '@buisnez/shared';
import { apiRequest } from './client';

export async function createClaim(body: CreateClaimRequest) {
  return apiRequest('/claims', claimSchema, {
    method: 'POST',
    body,
  });
}

export async function getMyClaims(): Promise<Claim[]> {
  const { data } = await apiRequest(
    '/claims/mine',
    z.object({ data: z.array(claimSchema) }),
  );
  return data.data;
}

export async function getMyClaimForBusiness(
  businessId: string,
): Promise<Claim | null> {
  const { data } = await apiRequest(
    '/claims/mine',
    z.object({ data: claimSchema.nullable() }),
    { query: { businessId } },
  );
  return data.data;
}
