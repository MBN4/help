import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@buisnez/database';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TokenService } from '../src/modules/auth/token.service';

describe('Admin RBAC (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenService: TokenService;
  const customerEmail = `e2e-rbac-customer-${Date.now()}@example.com`;
  const adminEmail = `e2e-rbac-admin-${Date.now()}@example.com`;
  let customerAccessToken: string;
  let adminAccessToken: string;

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
    const customer = await prisma.user.create({
      data: {
        email: customerEmail,
        name: 'RBAC Customer',
        passwordHash,
        role: Role.CUSTOMER,
      },
    });
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'RBAC Admin',
        passwordHash,
        role: Role.ADMIN,
      },
    });

    customerAccessToken = (
      await tokenService.issueTokenPair(customer.id, customer.role)
    ).accessToken;
    adminAccessToken = (await tokenService.issueTokenPair(admin.id, admin.role))
      .accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [customerEmail, adminEmail] } },
    });
    await app.close();
  });

  it('rejects an unauthenticated request with 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/ping').expect(401);
  });

  it('rejects a non-admin with 403', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/ping')
      .set('Authorization', `Bearer ${customerAccessToken}`)
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows an admin through', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/ping')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(res.body.data.pong).toBe(true);
  });
});
