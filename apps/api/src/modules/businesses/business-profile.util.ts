import type { DayOfWeek, RatingBreakdown } from '@buisnez/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { getKarachiNow } from '../search/karachi-time.util';

export const DAY_ORDER: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

export interface HoursWindow {
  dayOfWeek: DayOfWeek;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
}

/** Mirrors SearchService's openNowExpr()/docs/09-search-discovery.md, applied in application code. */
export function computeIsOpenNow(hours: HoursWindow[]): boolean {
  const { todayDow, yesterdayDow, nowTime } = getKarachiNow();

  const today = hours.find((entry) => entry.dayOfWeek === todayDow);
  if (today && !today.isClosed && today.opensAt && today.closesAt) {
    if (today.opensAt <= today.closesAt) {
      if (today.opensAt <= nowTime && nowTime <= today.closesAt) {
        return true;
      }
    } else if (nowTime >= today.opensAt) {
      return true;
    }
  }

  const yesterday = hours.find((entry) => entry.dayOfWeek === yesterdayDow);
  if (
    yesterday &&
    !yesterday.isClosed &&
    yesterday.opensAt &&
    yesterday.closesAt &&
    yesterday.opensAt > yesterday.closesAt &&
    nowTime <= yesterday.closesAt
  ) {
    return true;
  }

  return false;
}

/** Live-computed rating aggregates from `Review` rows — shared by the public profile and the owner "manage" view. */
export async function getBusinessAggregates(
  prisma: PrismaService,
  businessId: string,
): Promise<{
  averageRating: number | null;
  reviewCount: number;
  ratingBreakdown: RatingBreakdown;
}> {
  const grouped = await prisma.review.groupBy({
    by: ['rating'],
    where: { businessId, status: 'PUBLISHED' },
    _count: { _all: true },
  });

  const ratingBreakdown: RatingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let reviewCount = 0;
  let ratingSum = 0;
  for (const group of grouped) {
    const rating = group.rating as 1 | 2 | 3 | 4 | 5;
    ratingBreakdown[rating] = group._count._all;
    reviewCount += group._count._all;
    ratingSum += rating * group._count._all;
  }

  return {
    averageRating:
      reviewCount > 0 ? Math.round((ratingSum / reviewCount) * 10) / 10 : null,
    reviewCount,
    ratingBreakdown,
  };
}
