import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@buisnez/database';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import sharp from 'sharp';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TokenService } from '../src/modules/auth/token.service';

const CSRF_HEADER = ['X-Requested-With', 'buisnez-web'] as const;

describe('Business owner experience (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenService: TokenService;

  const suffix = Date.now();
  const ownerEmail = `e2e-owner-${suffix}@example.com`;
  const otherEmail = `e2e-owner-other-${suffix}@example.com`;
  const adminEmail = `e2e-owner-admin-${suffix}@example.com`;
  const reviewerEmail = `e2e-owner-reviewer-${suffix}@example.com`;

  let ownerId: string;
  let otherToken: string;
  let adminToken: string;
  let ownerToken: string;
  let reviewerId: string;

  let businessId: string;
  let categoryId: string;
  let cityId: string;
  let provinceId: string;
  let featureId: string;
  let reviewId: string;
  let serviceId: string;
  let photoId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);
    tokenService = app.get(TokenService);

    const passwordHash = await hash('irrelevant-for-this-test');
    const [owner, other, admin, reviewer] = await Promise.all([
      prisma.user.create({
        data: {
          email: ownerEmail,
          name: 'Owner Tester',
          passwordHash,
          role: Role.CUSTOMER,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.user.create({
        data: {
          email: otherEmail,
          name: 'Non-Owner Tester',
          passwordHash,
          role: Role.CUSTOMER,
        },
      }),
      prisma.user.create({
        data: {
          email: adminEmail,
          name: 'Admin Tester',
          passwordHash,
          role: Role.ADMIN,
        },
      }),
      prisma.user.create({
        data: {
          email: reviewerEmail,
          name: 'Reviewer Tester',
          passwordHash,
          role: Role.CUSTOMER,
          emailVerifiedAt: new Date(),
        },
      }),
    ]);
    ownerId = owner.id;
    reviewerId = reviewer.id;

    ownerToken = (await tokenService.issueTokenPair(owner.id, owner.role))
      .accessToken;
    otherToken = (await tokenService.issueTokenPair(other.id, other.role))
      .accessToken;
    adminToken = (await tokenService.issueTokenPair(admin.id, admin.role))
      .accessToken;

    const category = await prisma.category.findFirstOrThrow();
    const city = await prisma.city.findFirstOrThrow();
    const feature = await prisma.feature.findFirstOrThrow();
    categoryId = category.id;
    cityId = city.id;
    provinceId = city.provinceId;
    featureId = feature.id;

    // Fixture business created directly via Prisma (bypassing the API is expected for e2e fixtures) — this
    // suite must never mutate the seeded demo business, since business-profile.e2e-spec.ts asserts exact
    // hardcoded aggregate/review counts on it.
    const business = await prisma.business.create({
      data: {
        name: `E2E Owner Test Business ${suffix}`,
        slug: `e2e-owner-test-business-${suffix}`,
        categoryId,
        provinceId,
        cityId,
        addressLine: 'Test Address, Test City',
        status: 'PUBLISHED',
      },
    });
    businessId = business.id;

    await prisma.review.create({
      data: {
        businessId,
        userId: reviewer.id,
        rating: 4,
        title: 'Decent place',
        body: 'It was fine.',
      },
    });
    const review = await prisma.review.findFirstOrThrow({
      where: { businessId, userId: reviewer.id },
    });
    reviewId = review.id;
  });

  afterAll(async () => {
    await prisma.reviewHelpfulVote.deleteMany({
      where: { review: { businessId } },
    });
    await prisma.photo.deleteMany({ where: { businessId } });
    await prisma.review.deleteMany({ where: { businessId } });
    await prisma.businessService.deleteMany({ where: { businessId } });
    await prisma.businessFeature.deleteMany({ where: { businessId } });
    await prisma.businessHours.deleteMany({ where: { businessId } });
    await prisma.claim.deleteMany({ where: { businessId } });
    await prisma.business.delete({ where: { id: businessId } });
    await prisma.user.deleteMany({
      where: {
        email: { in: [ownerEmail, otherEmail, adminEmail, reviewerEmail] },
      },
    });
    await app.close();
  });

  describe('happy path for the real owner', () => {
    let claimId: string;

    it('creates a claim', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/claims')
        .set(...CSRF_HEADER)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ businessId, message: 'This is my business' })
        .expect(201);
      expect(res.body.data.status).toBe('PENDING');
      claimId = res.body.data.id as string;
    });

    it('approves the claim as ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/claims/${claimId}/approve`)
        .set(...CSRF_HEADER)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.data.status).toBe('APPROVED');

      const business = await prisma.business.findUniqueOrThrow({
        where: { id: businessId },
      });
      expect(business.ownerId).toBe(ownerId);

      const owner = await prisma.user.findUniqueOrThrow({
        where: { id: ownerId },
      });
      expect(owner.role).toBe(Role.BUSINESS_OWNER);
    });

    it('appears under GET /businesses/owned/mine', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/businesses/owned/mine')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      const ids = (res.body.data as { id: string }[]).map((b) => b.id);
      expect(ids).toContain(businessId);
    });

    it('fetches the manage profile', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/businesses/${businessId}/manage`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(res.body.data.ownerId).toBe(ownerId);
      expect(res.body.data.status).toBe('PUBLISHED');
    });

    it('updates business info', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/businesses/${businessId}`)
        .set(...CSRF_HEADER)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ phone: '+92-300-1234567' })
        .expect(200);
      expect(res.body.data.phone).toBe('+92-300-1234567');
    });

    it('sets hours for all 7 days', async () => {
      const days = [
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
        'SUNDAY',
      ];
      const res = await request(app.getHttpServer())
        .put(`/api/v1/businesses/${businessId}/hours`)
        .set(...CSRF_HEADER)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(
          days.map((dayOfWeek) => ({
            dayOfWeek,
            opensAt: '09:00',
            closesAt: '18:00',
            isClosed: false,
          })),
        )
        .expect(200);
      expect(res.body.data.hours).toHaveLength(7);
    });

    it('sets features', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/businesses/${businessId}/features`)
        .set(...CSRF_HEADER)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ featureIds: [featureId] })
        .expect(200);
      expect(
        (res.body.data.features as { id: string }[]).map((f) => f.id),
      ).toContain(featureId);
    });

    it('creates a service', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/businesses/${businessId}/services`)
        .set(...CSRF_HEADER)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Home Delivery', priceInPaisa: 15000 })
        .expect(201);
      expect(res.body.data.name).toBe('Home Delivery');
      serviceId = res.body.data.id as string;
    });

    it('updates the location', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/businesses/${businessId}/location`)
        .set(...CSRF_HEADER)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ lat: 24.8607, lng: 67.0011 })
        .expect(200);
      expect(res.body.data.location).toEqual({ lat: 24.8607, lng: 67.0011 });
    });

    it('uploads a photo via presign -> confirm', async () => {
      const presign = await request(app.getHttpServer())
        .post('/api/v1/photos/presign')
        .set(...CSRF_HEADER)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ contentType: 'image/jpeg' })
        .expect(201);
      const { uploadUrl, key } = presign.body.data as {
        uploadUrl: string;
        key: string;
      };

      const originalJpeg = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 3,
          background: { r: 20, g: 90, b: 160 },
        },
      })
        .jpeg()
        .toBuffer();
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': 'image/jpeg' },
        body: originalJpeg,
      });
      expect(uploadResponse.ok).toBe(true);

      const confirm = await request(app.getHttpServer())
        .post(`/api/v1/businesses/${businessId}/photos`)
        .set(...CSRF_HEADER)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ key, caption: 'owner upload' })
        .expect(201);
      expect(confirm.body.data.url).toBeTruthy();
      photoId = confirm.body.data.id as string;
    });

    it('replies to a review', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/businesses/${businessId}/reviews/${reviewId}/reply`)
        .set(...CSRF_HEADER)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reply: 'Thanks for the feedback!' })
        .expect(200);
      expect(res.body.data.ownerReply).toBe('Thanks for the feedback!');
    });

    it('deletes the reply', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/businesses/${businessId}/reviews/${reviewId}/reply`)
        .set(...CSRF_HEADER)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(res.body.data.ownerReply).toBeNull();
    });

    it('deletes the service', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/businesses/${businessId}/services/${serviceId}`)
        .set(...CSRF_HEADER)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
    });

    it('deletes the photo', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/businesses/${businessId}/photos/${photoId}`)
        .set(...CSRF_HEADER)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
    });
  });

  describe('authorization: a non-owner, non-admin user is rejected on every owner-mutation route', () => {
    const cases: {
      name: string;
      method: 'patch' | 'put' | 'post' | 'delete';
      path: () => string;
      body?: Record<string, unknown> | unknown[];
    }[] = [
      {
        name: 'PATCH info',
        method: 'patch',
        path: () => `/api/v1/businesses/${businessId}`,
        body: { phone: '+92-300-0000000' },
      },
      {
        name: 'PUT hours',
        method: 'put',
        path: () => `/api/v1/businesses/${businessId}/hours`,
        body: [],
      },
      {
        name: 'PUT features',
        method: 'put',
        path: () => `/api/v1/businesses/${businessId}/features`,
        body: { featureIds: [] },
      },
      {
        name: 'PATCH location',
        method: 'patch',
        path: () => `/api/v1/businesses/${businessId}/location`,
        body: { lat: 24.86, lng: 67.0 },
      },
      {
        name: 'POST services',
        method: 'post',
        path: () => `/api/v1/businesses/${businessId}/services`,
        body: { name: 'Hack' },
      },
      {
        name: 'PATCH services/:id',
        method: 'patch',
        path: () => `/api/v1/businesses/${businessId}/services/nonexistent`,
        body: { name: 'Hack' },
      },
      {
        name: 'DELETE services/:id',
        method: 'delete',
        path: () => `/api/v1/businesses/${businessId}/services/nonexistent`,
      },
      {
        name: 'POST photos',
        method: 'post',
        path: () => `/api/v1/businesses/${businessId}/photos`,
        body: { key: 'uploads/originals/fake.jpg' },
      },
      {
        name: 'DELETE photos/:id',
        method: 'delete',
        path: () => `/api/v1/businesses/${businessId}/photos/nonexistent`,
      },
      {
        name: 'PUT review reply',
        method: 'put',
        path: () =>
          `/api/v1/businesses/${businessId}/reviews/${reviewId}/reply`,
        body: { reply: 'Hack' },
      },
      {
        name: 'DELETE review reply',
        method: 'delete',
        path: () =>
          `/api/v1/businesses/${businessId}/reviews/${reviewId}/reply`,
      },
    ];

    for (const testCase of cases) {
      it(`${testCase.name} -> 403`, async () => {
        const req = request(app.getHttpServer())
          [testCase.method](testCase.path())
          .set(...CSRF_HEADER)
          .set('Authorization', `Bearer ${otherToken}`);
        const res = await (
          testCase.body ? req.send(testCase.body) : req
        ).expect(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      });
    }
  });
});
