import { Inject, Injectable } from '@nestjs/common';
import type { HomeDiscovery, RecentActivityItem } from '@buisnez/shared';
import type { Redis } from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../integrations/redis/redis.constants';
import { SearchService } from '../search/search.service';

const HOME_CACHE_KEY = 'discovery:home';
const HOME_CACHE_TTL_SECONDS = 10 * 60;
const RECENT_ACTIVITY_CACHE_KEY = 'discovery:recent-activity';
const RECENT_ACTIVITY_CACHE_TTL_SECONDS = 5 * 60;
const RECENT_ACTIVITY_MAX_LIMIT = 12;
const BLOCK_LIMIT = 6;

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly searchService: SearchService,
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getHome(): Promise<HomeDiscovery> {
    const cached = await this.redis.get(HOME_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as HomeDiscovery;
    }

    const [trending, highlyRated, featured, recent] = await Promise.all([
      this.searchService.listTrending(BLOCK_LIMIT),
      this.searchService.listHighlyRated(BLOCK_LIMIT),
      this.searchService.listFeatured(BLOCK_LIMIT),
      this.searchService.listRecent(BLOCK_LIMIT),
    ]);

    const result: HomeDiscovery = { trending, highlyRated, featured, recent };
    await this.redis.set(
      HOME_CACHE_KEY,
      JSON.stringify(result),
      'EX',
      HOME_CACHE_TTL_SECONDS,
    );
    return result;
  }

  /** For Phase 3+ write endpoints (new business published, review posted, etc.) to call directly. */
  async invalidateHomeCache(): Promise<void> {
    await this.redis.del(HOME_CACHE_KEY, RECENT_ACTIVITY_CACHE_KEY);
  }

  /** Phase 11: homepage "Recent Activity" feed. Read-only, composes existing tables — see the shared
   * schema's doc comment for why this couldn't be composed from an existing endpoint. */
  async getRecentActivity(limit: number): Promise<RecentActivityItem[]> {
    const cappedLimit = Math.min(limit, RECENT_ACTIVITY_MAX_LIMIT);
    const cacheKey = `${RECENT_ACTIVITY_CACHE_KEY}:${cappedLimit}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as RecentActivityItem[];
    }

    const reviews = await this.prisma.review.findMany({
      where: {
        status: 'PUBLISHED',
        business: { status: 'PUBLISHED', deletedAt: null },
      },
      include: {
        user: { select: { name: true, avatarUrl: true } },
        business: {
          select: {
            slug: true,
            name: true,
            city: { select: { name: true, slug: true } },
            area: { select: { name: true, slug: true } },
            photos: {
              where: { status: 'APPROVED' },
              orderBy: { createdAt: 'asc' },
              take: 1,
              select: { thumbUrl: true, cardUrl: true, url: true },
            },
          },
        },
        _count: { select: { helpfulVotes: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: cappedLimit,
    });

    const result: RecentActivityItem[] = reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      body: review.body,
      createdAt: review.createdAt.toISOString(),
      helpfulCount: review._count.helpfulVotes,
      userName: review.user.name,
      userAvatarUrl: review.user.avatarUrl,
      business: {
        slug: review.business.slug,
        name: review.business.name,
        city: review.business.city,
        area: review.business.area,
        thumbnailUrl:
          review.business.photos[0]?.cardUrl ??
          review.business.photos[0]?.thumbUrl ??
          review.business.photos[0]?.url ??
          null,
      },
    }));

    await this.redis.set(
      cacheKey,
      JSON.stringify(result),
      'EX',
      RECENT_ACTIVITY_CACHE_TTL_SECONDS,
    );
    return result;
  }
}
