import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import sharp from 'sharp';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailService } from '../src/integrations/mail/mail.service';

const CSRF_HEADER = ['X-Requested-With', 'buisnez-web'] as const;

function extractSetCookie(
  res: request.Response,
  name: string,
): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((cookie) => cookie.startsWith(`${name}=`))?.split(';')[0];
}

describe('Contributions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sendEmailVerification: jest.SpyInstance;
  let cookie: string;
  let businessId: string;
  const email = `e2e-contrib-${Date.now()}@example.com`;
  const password = 'super-secret-123';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);

    const mailService = app.get(MailService);
    sendEmailVerification = jest.spyOn(mailService, 'sendEmailVerification');

    const business = await prisma.business.findFirst({
      where: { status: 'PUBLISHED' },
    });
    businessId = business?.id as string;

    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set(...CSRF_HEADER)
      .send({ name: 'Contrib Tester', email, password })
      .expect(201);
    cookie = extractSetCookie(registerRes, 'access_token') as string;

    const rawToken = (
      sendEmailVerification.mock.calls[0] as [string, string]
    )[1];
    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .set(...CSRF_HEADER)
      .send({ token: rawToken })
      .expect(201);
  });

  afterAll(async () => {
    // Keep this business' aggregates clean for the Phase 2 profile e2e suite, which asserts exact seeded counts.
    await prisma.review.deleteMany({ where: { businessId, user: { email } } });
    await prisma.photo.deleteMany({ where: { businessId, user: { email } } });
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('blocks review creation from an unverified account with 403', async () => {
    const unverifiedEmail = `e2e-unverified-${Date.now()}@example.com`;
    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set(...CSRF_HEADER)
      .send({ name: 'Unverified Tester', email: unverifiedEmail, password })
      .expect(201);
    const unverifiedCookie = extractSetCookie(
      registerRes,
      'access_token',
    ) as string;

    const res = await request(app.getHttpServer())
      .put(`/api/v1/businesses/${businessId}/review`)
      .set(...CSRF_HEADER)
      .set('Cookie', unverifiedCookie)
      .send({ rating: 3 })
      .expect(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');

    await prisma.user.deleteMany({ where: { email: unverifiedEmail } });
  });

  it('creates a review, then edits the same one instead of duplicating it', async () => {
    const created = await request(app.getHttpServer())
      .put(`/api/v1/businesses/${businessId}/review`)
      .set(...CSRF_HEADER)
      .set('Cookie', cookie)
      .send({
        rating: 4,
        subRatings: { food: 4, service: 5 },
        title: 'Good',
        body: 'Solid experience.',
      })
      .expect(200);
    expect(created.body.data.rating).toBe(4);
    const reviewId = created.body.data.id as string;

    const edited = await request(app.getHttpServer())
      .put(`/api/v1/businesses/${businessId}/review`)
      .set(...CSRF_HEADER)
      .set('Cookie', cookie)
      .send({
        rating: 5,
        subRatings: { food: 5, service: 5 },
        title: 'Great',
        body: 'Even better on return.',
      })
      .expect(200);
    expect(edited.body.data.id).toBe(reviewId);
    expect(edited.body.data.rating).toBe(5);

    const count = await prisma.review.count({
      where: { businessId, id: reviewId },
    });
    expect(count).toBe(1);
  });

  it('toggles a helpful vote on the review', async () => {
    const review = await prisma.review.findFirst({
      where: { businessId, user: { email } },
    });
    const reviewId = review?.id as string;

    const first = await request(app.getHttpServer())
      .post(`/api/v1/reviews/${reviewId}/helpful`)
      .set(...CSRF_HEADER)
      .set('Cookie', cookie)
      .expect(201);
    expect(first.body.data).toEqual({ helpful: true, helpfulCount: 1 });

    const second = await request(app.getHttpServer())
      .post(`/api/v1/reviews/${reviewId}/helpful`)
      .set(...CSRF_HEADER)
      .set('Cookie', cookie)
      .expect(201);
    expect(second.body.data).toEqual({ helpful: false, helpfulCount: 0 });
  });

  it('toggles a favorite on and off', async () => {
    const on = await request(app.getHttpServer())
      .post('/api/v1/favorites/toggle')
      .set(...CSRF_HEADER)
      .set('Cookie', cookie)
      .send({ businessId })
      .expect(201);
    expect(on.body.data).toEqual({ favorited: true });

    const mine = await request(app.getHttpServer())
      .get('/api/v1/favorites/mine')
      .set('Cookie', cookie)
      .expect(200);
    expect(mine.body.data.map((b: { id: string }) => b.id)).toContain(
      businessId,
    );

    const off = await request(app.getHttpServer())
      .post('/api/v1/favorites/toggle')
      .set(...CSRF_HEADER)
      .set('Cookie', cookie)
      .send({ businessId })
      .expect(201);
    expect(off.body.data).toEqual({ favorited: false });
  });

  it('reports a business with a reason', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/reports')
      .set(...CSRF_HEADER)
      .set('Cookie', cookie)
      .send({
        targetType: 'BUSINESS',
        targetId: businessId,
        reason: 'SPAM',
        message: 'test',
      })
      .expect(201);
    expect(res.body.data.id).toBeTruthy();

    const report = await prisma.report.findUnique({
      where: { id: res.body.data.id },
    });
    expect(report?.businessId).toBe(businessId);
    expect(report?.status).toBe('PENDING');
  });

  it('uploads a photo through presign -> direct upload -> confirm and strips EXIF into 3 variants', async () => {
    const presign = await request(app.getHttpServer())
      .post('/api/v1/photos/presign')
      .set(...CSRF_HEADER)
      .set('Cookie', cookie)
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
        background: { r: 50, g: 120, b: 200 },
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
      .post('/api/v1/photos/confirm')
      .set(...CSRF_HEADER)
      .set('Cookie', cookie)
      .send({ key, businessId, caption: 'e2e upload' })
      .expect(201);

    expect(confirm.body.data.url).toBeTruthy();
    expect(confirm.body.data.thumbUrl).toBeTruthy();
    expect(confirm.body.data.cardUrl).toBeTruthy();

    const fullImage = await fetch(confirm.body.data.url as string);
    const fullBuffer = Buffer.from(await fullImage.arrayBuffer());
    const metadata = await sharp(fullBuffer).metadata();
    expect(metadata.width).toBeLessThanOrEqual(1600);
    expect(metadata.exif).toBeUndefined();
  });

  it('updates the profile (name/bio)', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set(...CSRF_HEADER)
      .set('Cookie', cookie)
      .send({ bio: 'Karachi-based foodie.' })
      .expect(200);
    expect(res.body.data.bio).toBe('Karachi-based foodie.');
  });
});
