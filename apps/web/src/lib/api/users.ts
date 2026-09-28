import { publicUserProfileSchema } from '@buisnez/shared';
import { apiRequest } from './client';

export async function getPublicUserProfile(userId: string) {
  return apiRequest(
    `/users/${encodeURIComponent(userId)}/public-profile`,
    publicUserProfileSchema,
  );
}
