import { z } from 'zod';

/** Public reviewer profile (Phase 8) — see docs/11-reviews-trust-safety.md. `isVerifiedReviewer` is always
 * computed live from the counts below, never a stored flag. */
export const publicUserProfileReviewSchema = z.object({
  id: z.string().uuid(),
  businessName: z.string(),
  businessSlug: z.string(),
  rating: z.number().int(),
  title: z.string().nullable(),
  body: z.string().nullable(),
  createdAt: z.string(),
});
export type PublicUserProfileReview = z.infer<
  typeof publicUserProfileReviewSchema
>;

export const publicUserProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  memberSince: z.string(),
  isVerifiedReviewer: z.boolean(),
  reviewCount: z.number().int(),
  photoCount: z.number().int(),
  helpfulVotesReceived: z.number().int(),
  recentReviews: z.array(publicUserProfileReviewSchema),
});
export type PublicUserProfile = z.infer<typeof publicUserProfileSchema>;
