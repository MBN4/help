import { PrismaService } from '../../prisma/prisma.service';

/**
 * Contribution-based "verified reviewer" badge thresholds (Phase 8) — tunable, see
 * docs/11-reviews-trust-safety.md. Deliberately not a stored flag: always computed live from the same
 * `PUBLISHED`-only counts the public profile shows, so it can never go stale relative to a removed review.
 */
export const VERIFIED_REVIEWER_MIN_REVIEWS = 5;
export const VERIFIED_REVIEWER_MIN_HELPFUL_VOTES = 10;

export interface ReviewerStats {
  reviewCount: number;
  photoCount: number;
  helpfulVotesReceived: number;
}

export function isVerifiedReviewer(stats: ReviewerStats): boolean {
  return (
    stats.reviewCount >= VERIFIED_REVIEWER_MIN_REVIEWS &&
    stats.helpfulVotesReceived >= VERIFIED_REVIEWER_MIN_HELPFUL_VOTES
  );
}

/** Single-user stats — used on review-write responses and the public profile page. */
export async function getReviewerStats(
  prisma: PrismaService,
  userId: string,
): Promise<ReviewerStats> {
  const [reviewCount, photoCount, helpfulAgg] = await Promise.all([
    prisma.review.count({ where: { userId, status: 'PUBLISHED' } }),
    prisma.photo.count({ where: { userId, status: 'APPROVED' } }),
    prisma.reviewHelpfulVote.count({
      where: { review: { userId, status: 'PUBLISHED' } },
    }),
  ]);
  return { reviewCount, photoCount, helpfulVotesReceived: helpfulAgg };
}

/** Bulk variant for a list of review authors (e.g. a business's review list) — avoids N+1 queries. */
export async function getReviewerStatsBulk(
  prisma: PrismaService,
  userIds: string[],
): Promise<Map<string, ReviewerStats>> {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return new Map();

  const [reviewCounts, photoCounts, helpfulCounts] = await Promise.all([
    prisma.review.groupBy({
      by: ['userId'],
      where: { userId: { in: uniqueIds }, status: 'PUBLISHED' },
      _count: { _all: true },
    }),
    prisma.photo.groupBy({
      by: ['userId'],
      where: { userId: { in: uniqueIds }, status: 'APPROVED' },
      _count: { _all: true },
    }),
    prisma.reviewHelpfulVote.findMany({
      where: { review: { userId: { in: uniqueIds }, status: 'PUBLISHED' } },
      select: { review: { select: { userId: true } } },
    }),
  ]);

  const stats = new Map<string, ReviewerStats>(
    uniqueIds.map((id) => [
      id,
      { reviewCount: 0, photoCount: 0, helpfulVotesReceived: 0 },
    ]),
  );
  for (const row of reviewCounts) {
    stats.get(row.userId)!.reviewCount = row._count._all;
  }
  for (const row of photoCounts) {
    stats.get(row.userId)!.photoCount = row._count._all;
  }
  for (const vote of helpfulCounts) {
    const entry = stats.get(vote.review.userId);
    if (entry) entry.helpfulVotesReceived += 1;
  }
  return stats;
}
