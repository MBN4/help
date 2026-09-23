import { Inject, Injectable } from '@nestjs/common';
import type { HomeDiscovery } from '@buisnez/shared';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../integrations/redis/redis.constants';
import { SearchService } from '../search/search.service';

const HOME_CACHE_KEY = 'discovery:home';
const HOME_CACHE_TTL_SECONDS = 10 * 60;
const BLOCK_LIMIT = 6;

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly searchService: SearchService,
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
    await this.redis.del(HOME_CACHE_KEY);
  }
}
