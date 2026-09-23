import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const CSRF_HEADER = ['X-Requested-With', 'buisnez-web'] as const;

function findSetCookie(
  res: request.Response,
  name: string,
): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((cookie) => cookie.startsWith(`${name}=`));
}

function extractSetCookie(
  res: request.Response,
  name: string,
): string | undefined {
  return findSetCookie(res, name)?.split(';')[0];
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sharedAccessCookie: string;
  const email = `e2e-auth-${Date.now()}@example.com`;
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
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('rejects a mutating request without the CSRF header', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(403);
  });

  it('registers a new user with httpOnly access + refresh cookies and no tokens in the body', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set(...CSRF_HEADER)
      .send({ name: 'E2E Tester', email, password })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.accessToken).toBeUndefined();
    expect(res.body.data.refreshToken).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('eyJ'); // no stray JWT anywhere in the body

    expect(extractSetCookie(res, 'access_token')).toBeTruthy();
    expect(findSetCookie(res, 'access_token')).toContain('HttpOnly');
    expect(extractSetCookie(res, 'refresh_token')).toBeTruthy();
    expect(findSetCookie(res, 'refresh_token')).toContain('HttpOnly');
  });

  it('rejects a duplicate registration with 409', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set(...CSRF_HEADER)
      .send({ name: 'E2E Tester', email, password })
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('rejects invalid login credentials with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set(...CSRF_HEADER)
      .send({ email, password: 'wrong-password' })
      .expect(401);
  });

  it('logs in via the access cookie, reads /me, and rotates the refresh token on /refresh', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set(...CSRF_HEADER)
      .send({ email, password })
      .expect(201);
    const accessCookie = extractSetCookie(loginRes, 'access_token') as string;
    const originalRefreshCookie = extractSetCookie(loginRes, 'refresh_token');
    expect(accessCookie).toBeTruthy();
    expect(originalRefreshCookie).toBeTruthy();
    sharedAccessCookie = accessCookie;

    const meRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', accessCookie)
      .expect(200);
    expect(meRes.body.data.email).toBe(email);

    const refreshRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set(...CSRF_HEADER)
      .set('Cookie', originalRefreshCookie as string)
      .expect(201);
    expect(refreshRes.body.data).toEqual({ refreshed: true });
    const rotatedAccessCookie = extractSetCookie(refreshRes, 'access_token');
    const rotatedRefreshCookie = extractSetCookie(refreshRes, 'refresh_token');
    expect(rotatedAccessCookie).toBeTruthy();
    expect(rotatedRefreshCookie).toBeTruthy();
    expect(rotatedRefreshCookie).not.toBe(originalRefreshCookie);

    // Reusing the now-rotated-away refresh token must fail (reuse detection).
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set(...CSRF_HEADER)
      .set('Cookie', originalRefreshCookie as string)
      .expect(401);
  });

  it('still accepts a Bearer access token (reserved for the future mobile app)', async () => {
    // Reuses the access cookie minted by the previous test instead of logging in again, to stay
    // comfortably under the 5/min login throttle shared across this file's test run.
    const accessToken = sharedAccessCookie
      .split('=')[1]
      ?.split(';')[0] as string;

    const meRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(meRes.body.data.email).toBe(email);
  });

  it('rejects /me without a token', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('logs out, clears cookies, and revokes the refresh session (access token stays valid until its own 15m expiry)', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set(...CSRF_HEADER)
      .send({ email, password })
      .expect(201);
    const accessCookie = extractSetCookie(loginRes, 'access_token') as string;
    const refreshCookie = extractSetCookie(loginRes, 'refresh_token') as string;

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set(...CSRF_HEADER)
      .set('Cookie', refreshCookie)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set(...CSRF_HEADER)
      .set('Cookie', refreshCookie)
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', accessCookie)
      .expect(200); // the access token itself is still valid for its remaining 15m — only the refresh session died
  });
});
