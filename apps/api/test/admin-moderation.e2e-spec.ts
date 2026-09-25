import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@buisnez/database';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TokenService } from '../src/modules/auth/token.service';

const CSRF_HEADER = ['X-Requested-With', 'buisnez-web'] as const;

describe('Admin & moderation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenService: TokenService;

  const suffix = Date.now();
  const claimantEmail = `e2e-admin-claimant-${suffix}@example.com`;
  const moderatorEmail = `e2e-admin-moderator-${suffix}@example.com`;
  const adminEmail = `e2e-admin-admin-${suffix}@example.com`;
  const reviewerEmail = `e2e-admin-reviewer-${suffix}@example.com`;
  const reporterEmail = `e2e-admin-reporter-${suffix}@example.com`;
  const banTargetEmail = `e2e-admin-bantarget-${suffix}@example.com`;

  let claimantId: string;
  let claimantToken: string;
  let moderatorToken: string;
  let adminToken: string;
  let reviewerId: string;
  let reporterToken: string;
  let banTargetId: string;
  let banTargetToken: string;

  let businessId: string;
  let categoryId: string;
  let cityId: string;
  let provinceId: string;
  let reviewId: string;

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
    const [claimant, moderator, admin, reviewer, reporter, banTarget] =
      await Promise.all([
        prisma.user.create({
          data: {
            email: claimantEmail,
            name: 'Claimant',
            passwordHash,
            role: Role.CUSTOMER,
          },
        }),
        prisma.user.create({
          data: {
            email: moderatorEmail,
            name: 'Moderator',
            passwordHash,
            role: Role.MODERATOR,
          },
        }),
        prisma.user.create({
          data: {
            email: adminEmail,
            name: 'Admin',
            passwordHash,
            role: Role.ADMIN,
          },
        }),
        prisma.user.create({
          data: {
            email: reviewerEmail,
            name: 'Reviewer',
            passwordHash,
            role: Role.CUSTOMER,
          },
        }),
        prisma.user.create({
          data: {
            email: reporterEmail,
            name: 'Reporter',
            passwordHash,
            role: Role.CUSTOMER,
          },
        }),
        prisma.user.create({
          data: {
            email: banTargetEmail,
            name: 'Ban Target',
            passwordHash,
            role: Role.CUSTOMER,
          },
        }),
      ]);
    claimantId = claimant.id;
    reviewerId = reviewer.id;
    banTargetId = banTarget.id;

    claimantToken = (
      await tokenService.issueTokenPair(claimant.id, claimant.role)
    ).accessToken;
    moderatorToken = (
      await tokenService.issueTokenPair(moderator.id, moderator.role)
    ).accessToken;
    adminToken = (await tokenService.issueTokenPair(admin.id, admin.role))
      .accessToken;
    reporterToken = (
      await tokenService.issueTokenPair(reporter.id, reporter.role)
    ).accessToken;
    banTargetToken = (
      await tokenService.issueTokenPair(banTarget.id, banTarget.role)
    ).accessToken;

    const category = await prisma.category.findFirstOrThrow();
    const city = await prisma.city.findFirstOrThrow();
    categoryId = category.id;
    cityId = city.id;
    provinceId = city.provinceId;

    // Fixture business created directly via Prisma — never touches seeded demo data (per PROGRESS.md's
    // shared-DB-contamination note); never mutates business-profile.e2e-spec.ts's hardcoded business.
    const business = await prisma.business.create({
      data: {
        name: `E2E Admin Test Business ${suffix}`,
        slug: `e2e-admin-test-business-${suffix}`,
        categoryId,
        provinceId,
        cityId,
        addressLine: 'Test Address, Test City',
        status: 'PUBLISHED',
      },
    });
    businessId = business.id;

    const review = await prisma.review.create({
      data: {
        businessId,
        userId: reviewer.id,
        rating: 2,
        title: 'Not great',
        body: 'Had issues.',
      },
    });
    reviewId = review.id;
  });

  afterAll(async () => {
    await prisma.moderationLog.deleteMany({
      where: {
        OR: [
          { targetId: businessId },
          { targetId: reviewId },
          { actorId: { in: [claimantId, banTargetId] } },
        ],
      },
    });
    await prisma.report.deleteMany({ where: { businessId } });
    await prisma.review.deleteMany({ where: { businessId } });
    await prisma.claim.deleteMany({ where: { businessId } });
    await prisma.business.delete({ where: { id: businessId } });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            claimantEmail,
            moderatorEmail,
            adminEmail,
            reviewerEmail,
            reporterEmail,
            banTargetEmail,
          ],
        },
      },
    });
    await app.close();
  });

  describe('MODERATOR happy path: claim -> approve -> owner access -> report -> resolve', () => {
    let claimId: string;
    let reportId: string;

    it('claimant files a claim', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/claims')
        .set(...CSRF_HEADER)
        .set('Authorization', `Bearer ${claimantToken}`)
        .send({ businessId, message: 'This is my business' })
        .expect(201);
      claimId = res.body.data.id as string;
    });

    it('MODERATOR approves the claim with verifyBusiness=true', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/claims/${claimId}/approve`)
        .set(...CSRF_HEADER)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({ verifyBusiness: true })
        .expect(200);
      expect(res.body.data.status).toBe('APPROVED');

      const business = await prisma.business.findUniqueOrThrow({
        where: { id: businessId },
      });
      expect(business.ownerId).toBe(claimantId);
      expect(business.isVerified).toBe(true);
    });

    it('claimant can now hit a Phase 6 owner-guarded route (critical cross-phase check)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/businesses/${businessId}/manage`)
        .set('Authorization', `Bearer ${claimantToken}`)
        .expect(200);
      expect(res.body.data.ownerId).toBe(claimantId);
    });

    it('ModerationLog recorded the claim approval', async () => {
      const entries = await prisma.moderationLog.findMany({
        where: { targetType: 'CLAIM', targetId: claimId },
      });
      expect(entries.some((e) => e.action === 'CLAIM_APPROVED')).toBe(true);
    });

    it('a customer reports the review', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/reports')
        .set(...CSRF_HEADER)
        .set('Authorization', `Bearer ${reporterToken}`)
        .send({
          targetType: 'REVIEW',
          targetId: reviewId,
          reason: 'INAPPROPRIATE',
        })
        .expect(201);
      reportId = res.body.data.id as string;
    });

    it('MODERATOR sees the report in the grouped queue', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/reports?status=PENDING')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(200);
      const group = (
        res.body.data as { targetType: string; targetId: string }[]
      ).find((g) => g.targetType === 'REVIEW' && g.targetId === reviewId);
      expect(group).toBeDefined();
    });

    it('MODERATOR resolves the report by removing the review', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/reports/${reportId}/resolve`)
        .set(...CSRF_HEADER)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({
          reason: 'Confirmed inappropriate content',
          action: 'REMOVE_CONTENT',
        })
        .expect(200);

      const review = await prisma.review.findUniqueOrThrow({
        where: { id: reviewId },
      });
      expect(review.status).toBe('REMOVED');
    });

    it('aggregates on the business profile no longer include the removed review', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/businesses/${await slugFor(prisma, businessId)}`)
        .expect(200);
      expect(res.body.data.aggregates.reviewCount).toBe(0);
    });

    it('ModerationLog has entries for both the resolve and the removal', async () => {
      const reportLogs = await prisma.moderationLog.findMany({
        where: { targetType: 'REPORT', targetId: reportId },
      });
      expect(reportLogs.some((e) => e.action === 'REPORT_RESOLVED')).toBe(true);
      const reviewLogs = await prisma.moderationLog.findMany({
        where: { targetType: 'REVIEW', targetId: reviewId },
      });
      expect(reviewLogs.some((e) => e.action === 'REVIEW_REMOVED')).toBe(true);
    });
  });

  describe('MODERATOR is blocked from every ADMIN-only route (403 table)', () => {
    const cases: [
      string,
      string,
      string,
      Record<string, unknown> | undefined,
    ][] = [
      ['GET', '/api/v1/admin/users', '', undefined],
      ['GET', '/api/v1/admin/users/does-not-matter', '', undefined],
      ['PATCH', '/api/v1/admin/users/does-not-matter/ban', '', { reason: 'x' }],
      ['PATCH', '/api/v1/admin/users/does-not-matter/unban', '', undefined],
      [
        'PATCH',
        '/api/v1/admin/users/does-not-matter/role',
        '',
        { role: 'ADMIN' },
      ],
      [
        'PATCH',
        '/api/v1/admin/businesses/does-not-matter/featured',
        '',
        { featured: true },
      ],
      ['POST', '/api/v1/admin/businesses', '', { name: 'x' }],
      [
        'POST',
        '/api/v1/admin/taxonomy/categories',
        '',
        { name: 'x', slug: 'x' },
      ],
      [
        'PATCH',
        '/api/v1/admin/taxonomy/categories/does-not-matter',
        '',
        { name: 'x' },
      ],
      [
        'DELETE',
        '/api/v1/admin/taxonomy/categories/does-not-matter',
        '',
        undefined,
      ],
    ];

    it.each(cases)(
      '%s %s -> 403 for MODERATOR',
      async (method, path, _unused, body) => {
        const req = request(app.getHttpServer())
          [method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete'](path)
          .set('Authorization', `Bearer ${moderatorToken}`);
        if (method !== 'GET') {
          req.set(...CSRF_HEADER);
        }
        const res = body ? await req.send(body) : await req.send();
        expect(res.status).toBe(403);
      },
    );
  });

  describe('Ban enforcement: revoke immediately', () => {
    it('the ban target can hit an authenticated route before the ban', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${banTargetToken}`)
        .expect(200);
    });

    it('ADMIN bans the target user', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${banTargetId}/ban`)
        .set(...CSRF_HEADER)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Abuse' })
        .expect(200);
      expect(res.body.data.isBanned).toBe(true);
    });

    it('the SAME still-valid, not-expired access token is now rejected with 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${banTargetToken}`)
        .expect(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('ADMIN unbans the target user', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${banTargetId}/unban`)
        .set(...CSRF_HEADER)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('Soft-delete', () => {
    let softDeleteBusinessId: string;
    let softDeleteSlug: string;

    beforeAll(async () => {
      softDeleteSlug = `e2e-admin-softdelete-${suffix}`;
      const business = await prisma.business.create({
        data: {
          name: `E2E Soft Delete Business ${suffix}`,
          slug: softDeleteSlug,
          categoryId,
          provinceId,
          cityId,
          addressLine: 'Test Address, Test City',
          status: 'PUBLISHED',
        },
      });
      softDeleteBusinessId = business.id;
    });

    afterAll(async () => {
      await prisma.moderationLog.deleteMany({
        where: { targetId: softDeleteBusinessId },
      });
      await prisma.business.deleteMany({ where: { id: softDeleteBusinessId } });
    });

    it('is visible in public search before deletion', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/businesses/${softDeleteSlug}`)
        .expect(200);
      expect(res.body.data.slug).toBe(softDeleteSlug);
    });

    it('ADMIN soft-deletes it', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/admin/businesses/${softDeleteBusinessId}`)
        .set(...CSRF_HEADER)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('disappears from the public profile route (404)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/businesses/${softDeleteSlug}`)
        .expect(404);
    });

    it('is still visible via the admin detail route', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/businesses/${softDeleteBusinessId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.data.id).toBe(softDeleteBusinessId);
    });

    it('restoring brings it back to the public profile route', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/admin/businesses/${softDeleteBusinessId}/restore`)
        .set(...CSRF_HEADER)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/businesses/${softDeleteSlug}`)
        .expect(200);
      expect(res.body.data.slug).toBe(softDeleteSlug);
    });
  });
});

async function slugFor(
  prisma: PrismaService,
  businessId: string,
): Promise<string> {
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
  });
  return business.slug;
}
