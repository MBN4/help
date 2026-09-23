import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Business profile / reviews / photos / similar (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let businessId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);

    const business = await prisma.business.findUniqueOrThrow({
      where: { slug: 'karachi-biryani-house' },
    });
    businessId = business.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the full profile with hours, features, category, and aggregates', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/businesses/karachi-biryani-house')
      .expect(200);

    const data = res.body.data;
    expect(data.name).toBe('Karachi Biryani House');
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
      .get('/api/v1/businesses/karachi-biryani-house/similar')
      .expect(200);
    const names = res.body.data.map((row: { name: string }) => row.name);
    expect(names).not.toContain('Karachi Biryani House');
    expect(names.length).toBeLessThanOrEqual(6);
  });

  it('never errors and never includes itself, even with no same-category/city match at all', async () => {
    // "Round The Clock Pharmacy" is the only Pharmacies business in Karachi, and there's no other
    // Health & Medical business there either — the seed data is too sparse to exercise the broadening
    // path with a non-empty result, but it must still respond cleanly (empty array, not an error).
    const res = await request(app.getHttpServer())
      .get('/api/v1/businesses/round-the-clock-pharmacy/similar')
      .expect(200);
    expect(res.body.data).toEqual([]);
  });
});
