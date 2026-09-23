import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Redis } from 'ioredis';
import { AppModule } from '../src/app.module';
import { DiscoveryService } from '../src/modules/discovery/discovery.service';
import { REDIS_CLIENT } from '../src/integrations/redis/redis.constants';

const HOME_CACHE_KEY = 'discovery:home';

describe('Homepage discovery (e2e)', () => {
  let app: INestApplication;
  let discoveryService: DiscoveryService;
  let redis: Redis;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    discoveryService = app.get(DiscoveryService);
    redis = app.get(REDIS_CLIENT);
    await discoveryService.invalidateHomeCache();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns all four blocks with sane membership', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/discovery/home')
      .expect(200);
    const { trending, highlyRated, featured, recent } = res.body.data;

    expect(trending.length).toBeGreaterThan(0);
    expect(recent.length).toBeGreaterThan(0);

    expect(featured.map((b: { name: string }) => b.name).sort()).toEqual([
      'Lahore Fort Cafe',
      'Peshawar Heritage Restaurant',
    ]);

    // Only businesses with >= 3 reviews are eligible, so a single 5-star review can never appear here.
    for (const business of highlyRated) {
      expect(business.reviewCount).toBeGreaterThanOrEqual(3);
    }
    expect(highlyRated.map((b: { name: string }) => b.name)).not.toContain(
      'Round The Clock Pharmacy',
    );
  });

  it('populates the Redis cache key on first read and serves identical content on the next', async () => {
    await discoveryService.invalidateHomeCache();
    expect(await redis.get(HOME_CACHE_KEY)).toBeNull();

    const first = await request(app.getHttpServer())
      .get('/api/v1/discovery/home')
      .expect(200);
    expect(await redis.get(HOME_CACHE_KEY)).not.toBeNull();

    const second = await request(app.getHttpServer())
      .get('/api/v1/discovery/home')
      .expect(200);
    expect(second.body.data).toEqual(first.body.data);
  });

  it('invalidateHomeCache() actually clears the Redis key', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/discovery/home')
      .expect(200);
    expect(await redis.get(HOME_CACHE_KEY)).not.toBeNull();

    await discoveryService.invalidateHomeCache();
    expect(await redis.get(HOME_CACHE_KEY)).toBeNull();
  });
});
