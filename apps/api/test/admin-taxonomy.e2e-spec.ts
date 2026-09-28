import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@buisnez/database';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TokenService } from '../src/modules/auth/token.service';

const CSRF_HEADER = ['X-Requested-With', 'buisnez-web'] as const;

/**
 * Backend e2e coverage for `POST/PATCH/DELETE /admin/taxonomy/areas` — despite docs/PROGRESS.md's Phase 7
 * notes claiming taxonomy is "fully built and tested at the API layer", `areas` had zero coverage (only
 * `categories` RBAC was exercised, in admin-moderation.e2e-spec.ts). Self-seeded/self-cleaned fixture
 * province + city (never touches the shared seeded demo data) so this suite can run standalone.
 */
describe('Admin taxonomy: areas (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenService: TokenService;

  const suffix = Date.now();
  const adminEmail = `e2e-taxonomy-admin-${suffix}@example.com`;
  const moderatorEmail = `e2e-taxonomy-moderator-${suffix}@example.com`;

  let adminToken: string;
  let moderatorToken: string;

  let provinceId: string;
  let cityId: string;
  let secondCityId: string;
  const createdAreaIds: string[] = [];

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
    const [admin, moderator] = await Promise.all([
      prisma.user.create({
        data: {
          email: adminEmail,
          name: 'Taxonomy Admin',
          passwordHash,
          role: Role.ADMIN,
        },
      }),
      prisma.user.create({
        data: {
          email: moderatorEmail,
          name: 'Taxonomy Moderator',
          passwordHash,
          role: Role.MODERATOR,
        },
      }),
    ]);
    adminToken = (await tokenService.issueTokenPair(admin.id, admin.role))
      .accessToken;
    moderatorToken = (
      await tokenService.issueTokenPair(moderator.id, moderator.role)
    ).accessToken;

    const province = await prisma.province.create({
      data: {
        name: `E2E Taxonomy Province ${suffix}`,
        slug: `e2e-taxonomy-province-${suffix}`,
      },
    });
    provinceId = province.id;

    const city = await prisma.city.create({
      data: {
        provinceId,
        name: `E2E Taxonomy City ${suffix}`,
        slug: `e2e-taxonomy-city-${suffix}`,
      },
    });
    cityId = city.id;

    const secondCity = await prisma.city.create({
      data: {
        provinceId,
        name: `E2E Taxonomy Second City ${suffix}`,
        slug: `e2e-taxonomy-second-city-${suffix}`,
      },
    });
    secondCityId = secondCity.id;
  });

  afterAll(async () => {
    await prisma.area.deleteMany({
      where: { OR: [{ cityId }, { cityId: secondCityId }] },
    });
    await prisma.city.deleteMany({
      where: { id: { in: [cityId, secondCityId] } },
    });
    await prisma.province.delete({ where: { id: provinceId } });
    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail, moderatorEmail] } },
    });
    await app.close();
  });

  it('MODERATOR is denied (403) on every area-mutation route', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/admin/taxonomy/areas')
      .set(...CSRF_HEADER)
      .set('Authorization', `Bearer ${moderatorToken}`)
      .send({ name: 'x', slug: 'x', cityId })
      .expect(403);
    expect(createRes.body.error.code).toBe('FORBIDDEN');

    await request(app.getHttpServer())
      .patch('/api/v1/admin/taxonomy/areas/does-not-matter')
      .set(...CSRF_HEADER)
      .set('Authorization', `Bearer ${moderatorToken}`)
      .send({ name: 'y' })
      .expect(403);

    await request(app.getHttpServer())
      .delete('/api/v1/admin/taxonomy/areas/does-not-matter')
      .set(...CSRF_HEADER)
      .set('Authorization', `Bearer ${moderatorToken}`)
      .expect(403);
  });

  it('ADMIN creates an area under the fixture city', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/taxonomy/areas')
      .set(...CSRF_HEADER)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `E2E Area ${suffix}`,
        slug: `e2e-area-${suffix}`,
        cityId,
      })
      .expect(201);
    expect(res.body.data.cityId).toBe(cityId);
    expect(res.body.data.name).toBe(`E2E Area ${suffix}`);
    createdAreaIds.push(res.body.data.id as string);

    const inDb = await prisma.area.findUnique({
      where: { id: res.body.data.id as string },
    });
    expect(inDb).not.toBeNull();
    expect(inDb?.cityId).toBe(cityId);
  });

  it('the new area shows up on the public /locations/areas route for its city', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/locations/areas?city=e2e-taxonomy-city-${suffix}`)
      .expect(200);
    const names = (res.body.data as { name: string }[]).map((a) => a.name);
    expect(names).toContain(`E2E Area ${suffix}`);
  });

  it('rejects creating an area with a duplicate slug in the same city', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/taxonomy/areas')
      .set(...CSRF_HEADER)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `E2E Area Dup ${suffix}`,
        slug: `e2e-area-${suffix}`,
        cityId,
      })
      .expect((res) => {
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.status).toBeLessThan(500);
      });
  });

  it('ADMIN updates the area (rename + move to a different city)', async () => {
    const areaId = createdAreaIds[0];
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/taxonomy/areas/${areaId}`)
      .set(...CSRF_HEADER)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `E2E Area Renamed ${suffix}`,
        slug: `e2e-area-renamed-${suffix}`,
        cityId: secondCityId,
      })
      .expect(200);
    expect(res.body.data.name).toBe(`E2E Area Renamed ${suffix}`);
    expect(res.body.data.cityId).toBe(secondCityId);

    const inDb = await prisma.area.findUniqueOrThrow({ where: { id: areaId } });
    expect(inDb.cityId).toBe(secondCityId);
    expect(inDb.slug).toBe(`e2e-area-renamed-${suffix}`);
  });

  it('rejects an invalid update payload (schema validation)', async () => {
    const areaId = createdAreaIds[0];
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/taxonomy/areas/${areaId}`)
      .set(...CSRF_HEADER)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ cityId: 'not-a-uuid' })
      .expect(400);
  });

  it('ADMIN deletes the area', async () => {
    const areaId = createdAreaIds.pop() as string;
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/taxonomy/areas/${areaId}`)
      .set(...CSRF_HEADER)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const inDb = await prisma.area.findUnique({ where: { id: areaId } });
    expect(inDb).toBeNull();
  });

  it('404s deleting an area that no longer exists', async () => {
    const areaId = createdAreaIds.length
      ? createdAreaIds[createdAreaIds.length - 1]
      : 'c0ffee00-0000-4000-8000-000000000000';
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/taxonomy/areas/${areaId}`)
      .set(...CSRF_HEADER)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
