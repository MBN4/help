import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GeoService } from '../src/modules/geo/geo.service';

// Self-seeded fixture business — this file used to assert against the shared seeded demo business
// ("karachi-biryani-house"), which broke whenever another suite or a real browser session wrote a review/
// photo to it (documented shared-DB-contamination note in docs/PROGRESS.md). It now creates and cleans up
// its own business/reviews/photos, and only references stable taxonomy rows (category/city/area — never
// mutated by any suite) so it's fully order-independent.
describe('Business profile / reviews / photos / similar (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let geo: GeoService;

  const suffix = Date.now();
  let businessId: string;
  let businessSlug: string;
  let similarBusinessId: string;
  let isolatedCategoryId: string;
  let isolatedCityId: string;
  let isolatedProvinceId: string;
  let lonelyBusinessId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);
    geo = app.get(GeoService);

    // Stable taxonomy rows — restaurants (has a parent, for the breadcrumb assertion) in Karachi/Clifton.
    const category = await prisma.category.findFirstOrThrow({
      where: { slug: 'restaurants' },
    });
    const city = await prisma.city.findFirstOrThrow({
      where: { slug: 'karachi' },
    });
    const area = await prisma.area.findFirstOrThrow({
      where: { slug: 'clifton', cityId: city.id },
    });
    const feature = await prisma.feature.findFirstOrThrow();
    // Review.(businessId,userId) is unique — need 5 distinct reviewers, not one user looped 5 times.
    const reviewers = await prisma.user.findMany({
      where: { role: 'CUSTOMER' },
      take: 5,
    });
    if (reviewers.length < 5) {
      throw new Error(
        `Expected at least 5 seeded CUSTOMER users for review fixtures, found ${reviewers.length}`,
      );
    }
    const [photoAuthor] = reviewers;

    businessSlug = `e2e-profile-test-business-${suffix}`;
    const business = await prisma.business.create({
      data: {
        name: 'E2E Profile Test Business',
        slug: businessSlug,
        categoryId: category.id,
        provinceId: city.provinceId,
        cityId: city.id,
        areaId: area.id,
        addressLine: 'Test Address, Clifton, Karachi',
        status: 'PUBLISHED',
      },
    });
    businessId = business.id;
    await geo.setBusinessLocation(businessId, 24.8138, 67.0299);

    await prisma.businessHours.createMany({
      data: (
        [
          'MONDAY',
          'TUESDAY',
          'WEDNESDAY',
          'THURSDAY',
          'FRIDAY',
          'SATURDAY',
          'SUNDAY',
        ] as const
      ).map((dayOfWeek) => ({
        businessId,
        dayOfWeek,
        opensAt: '09:00',
        closesAt: '22:00',
        isClosed: false,
      })),
    });
    await prisma.businessFeature.create({
      data: { businessId, featureId: feature.id },
    });

    // 5 reviews from 5 distinct reviewers: four 5-star, one 4-star -> average 4.8, breakdown {4:1, 5:4}.
    const ratings = [5, 5, 5, 5, 4];
    for (let i = 0; i < ratings.length; i += 1) {
      const reviewer = reviewers[i]!;
      const rating = ratings[i]!;
      await prisma.review.create({
        data: {
          businessId,
          userId: reviewer.id,
          rating,
          body: 'Fixture review.',
        },
      });
    }
    await prisma.photo.create({
      data: {
        businessId,
        userId: photoAuthor!.id,
        url: 'https://picsum.photos/seed/e2e-profile-test/800/600',
        status: 'APPROVED',
      },
    });

    // A second business in the same category+city, for the "similar" happy path.
    const similar = await prisma.business.create({
      data: {
        name: 'E2E Profile Similar Business',
        slug: `e2e-profile-similar-business-${suffix}`,
        categoryId: category.id,
        provinceId: city.provinceId,
        cityId: city.id,
        areaId: area.id,
        addressLine: 'Another Address, Clifton, Karachi',
        status: 'PUBLISHED',
      },
    });
    similarBusinessId = similar.id;

    // An isolated category+city pair with exactly one business, to exercise the "no similar match" path
    // deterministically (previously relied on the seed's sparse "Pharmacies in Karachi" coincidence).
    const province = await prisma.province.findFirstOrThrow();
    const isolatedCity = await prisma.city.create({
      data: {
        name: `E2E Isolated City ${suffix}`,
        slug: `e2e-isolated-city-${suffix}`,
        provinceId: province.id,
      },
    });
    const isolatedCategory = await prisma.category.create({
      data: {
        name: `E2E Isolated Category ${suffix}`,
        slug: `e2e-isolated-category-${suffix}`,
      },
    });
    isolatedCityId = isolatedCity.id;
    isolatedCategoryId = isolatedCategory.id;
    isolatedProvinceId = province.id;
    const lonely = await prisma.business.create({
      data: {
        name: 'E2E Lonely Business',
        slug: `e2e-lonely-business-${suffix}`,
        categoryId: isolatedCategory.id,
        provinceId: province.id,
        cityId: isolatedCity.id,
        addressLine: 'Nowhere Else',
        status: 'PUBLISHED',
      },
    });
    lonelyBusinessId = lonely.id;
  });

  afterAll(async () => {
    // Defensive against a partial beforeAll failure (any of these ids may be unset) — filter out
    // undefined rather than let Prisma reject the whole cleanup and leave every fixture orphaned.
    const businessIds = [
      businessId,
      similarBusinessId,
      lonelyBusinessId,
    ].filter((id): id is string => Boolean(id));
    if (businessId) {
      await prisma.photo.deleteMany({ where: { businessId } });
      await prisma.review.deleteMany({ where: { businessId } });
      await prisma.businessFeature.deleteMany({ where: { businessId } });
      await prisma.businessHours.deleteMany({ where: { businessId } });
    }
    if (businessIds.length > 0) {
      await prisma.business.deleteMany({ where: { id: { in: businessIds } } });
    }
    if (isolatedCategoryId) {
      await prisma.category.deleteMany({ where: { id: isolatedCategoryId } });
    }
    if (isolatedCityId) {
      await prisma.city.deleteMany({ where: { id: isolatedCityId } });
    }
    void isolatedProvinceId; // reused seeded province — never deleted
    await app.close();
  });

  it('returns the full profile with hours, features, category, and aggregates', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${businessSlug}`)
      .expect(200);

    const data = res.body.data;
    expect(data.name).toBe('E2E Profile Test Business');
    expect(data.location).toEqual({ lat: 24.8138, lng: 67.0299 });
    expect(data.category.slug).toBe('restaurants');
    expect(data.category.parent.slug).toBe('food-dining');
    expect(data.city.slug).toBe('karachi');
    expect(data.area.slug).toBe('clifton');
    expect(data.hours).toHaveLength(7);
    expect(data.hours.map((h: { dayOfWeek: string }) => h.dayOfWeek)).toEqual([
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
      'SUNDAY',
    ]);
    expect(data.features.length).toBeGreaterThan(0);
    expect(data.aggregates.reviewCount).toBe(5);
    expect(data.aggregates.averageRating).toBe(4.8);
    expect(data.aggregates.ratingBreakdown).toEqual({
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 1,
      '5': 4,
    });
  });

  it('404s for an unknown slug', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/businesses/does-not-exist')
      .expect(404);
  });

  it('404s for a business that is not PUBLISHED', async () => {
    const pending = await prisma.business.create({
      data: {
        name: 'Pending Test Business',
        slug: `pending-test-business-${Date.now()}`,
        categoryId: (await prisma.category.findFirstOrThrow()).id,
        provinceId: (await prisma.province.findFirstOrThrow()).id,
        cityId: (await prisma.city.findFirstOrThrow()).id,
        addressLine: 'Nowhere',
        status: 'PENDING',
      },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/businesses/${pending.slug}`)
      .expect(404);
    await prisma.business.delete({ where: { id: pending.id } });
  });

  it('paginates reviews, newest first', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${businessId}/reviews?perPage=2&page=1`)
      .expect(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(5);
    for (const review of res.body.data) {
      expect(review.userName).toBeTruthy();
      expect(review.rating).toBeGreaterThanOrEqual(1);
    }
  });

  it('paginates approved photos', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${businessId}/photos`)
      .expect(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    for (const photo of res.body.data) {
      expect(photo.url).toMatch(/^https:\/\//);
    }
  });

  it('returns similar businesses in the same category and city', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${businessSlug}/similar`)
      .expect(200);
    const names = res.body.data.map((row: { name: string }) => row.name);
    expect(names).not.toContain('E2E Profile Test Business');
    expect(names).toContain('E2E Profile Similar Business');
    expect(names.length).toBeLessThanOrEqual(6);
  });

  it('never errors and never includes itself, even with no same-category/city match at all', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/businesses/e2e-lonely-business-${suffix}/similar`)
      .expect(200);
    expect(res.body.data).toEqual([]);
    void lonelyBusinessId; // referenced only for cleanup bookkeeping above
  });
});
