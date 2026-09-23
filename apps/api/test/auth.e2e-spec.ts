import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

function extractSetCookie(
  res: request.Response,
  name: string,
): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const found = raw?.find((cookie) => cookie.startsWith(`${name}=`));
  return found?.split(';')[0];
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
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

  it('registers a new user with an access token and a refresh cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'E2E Tester', email, password })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe(email);
    expect(extractSetCookie(res, 'refresh_token')).toBeTruthy();
  });

  it('rejects a duplicate registration with 409', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'E2E Tester', email, password })
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('rejects invalid login credentials with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
  });

  it('logs in, reads /me, and rotates the refresh token on /refresh', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(201);
    const accessToken = loginRes.body.data.accessToken as string;
    const originalRefreshCookie = extractSetCookie(loginRes, 'refresh_token');
    expect(originalRefreshCookie).toBeTruthy();

    const meRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(meRes.body.data.email).toBe(email);

    const refreshRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', originalRefreshCookie as string)
      .expect(201);
    expect(refreshRes.body.data.accessToken).toBeTruthy();
    const rotatedCookie = extractSetCookie(refreshRes, 'refresh_token');
    expect(rotatedCookie).toBeTruthy();
    expect(rotatedCookie).not.toBe(originalRefreshCookie);

    // Reusing the now-rotated-away refresh token must fail (reuse detection).
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', originalRefreshCookie as string)
      .expect(401);
  });

  it('rejects /me without a token', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('logs out and invalidates the refresh cookie', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(201);
    const cookie = extractSetCookie(loginRes, 'refresh_token') as string;

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie)
      .expect(401);
  });
});
