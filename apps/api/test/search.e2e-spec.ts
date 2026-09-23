import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface SearchResponseBody {
  success: boolean;
  data: {
    name: string;
    distanceMeters: number | null;
    averageRating: number | null;
  }[];
  meta: { page: number; perPage: number; total: number };
}

function names(body: SearchResponseBody): string[] {
  return body.data.map((row) => row.name).sort();
}

describe('Business search (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  function search(query: string): request.Test {
    return request(app.getHttpServer()).get(`/api/v1/businesses${query}`);
  }

  it('returns every published demo business with no filters', async () => {
    const res = await search('?perPage=50').expect(200);
    const body = res.body as SearchResponseBody;
    expect(body.meta.total).toBe(8);
    expect(body.data).toHaveLength(8);
  });

  it('filters by keyword against searchVector', async () => {
    const res = await search('?q=biryani').expect(200);
    expect(names(res.body as SearchResponseBody)).toEqual([
      'Karachi Biryani House',
    ]);
  });

  it('filters by category, including only that leaf category', async () => {
    const res = await search('?category=restaurants').expect(200);
    expect(names(res.body as SearchResponseBody)).toEqual([
      'Karachi Biryani House',
      'Peshawar Heritage Restaurant',
    ]);
  });

  it('returns an empty result set for an unknown category slug', async () => {
    const res = await search('?category=not-a-real-category').expect(200);
    const body = res.body as SearchResponseBody;
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });

  it('filters by city', async () => {
    const res = await search('?city=karachi').expect(200);
    expect(names(res.body as SearchResponseBody)).toEqual([
      'Karachi Biryani House',
      'Round The Clock Pharmacy',
      'Speedy Auto Workshop',
    ]);
  });

  it('filters by area', async () => {
    const res = await search('?area=clifton').expect(200);
    expect(names(res.body as SearchResponseBody)).toEqual([
      'Karachi Biryani House',
    ]);
  });

  it('filters by minRating using the simple average', async () => {
    const res = await search('?minRating=4.5&perPage=50').expect(200);
    const body = res.body as SearchResponseBody;
    for (const row of body.data) {
      expect(row.averageRating).not.toBeNull();
      expect(row.averageRating as number).toBeGreaterThanOrEqual(4.5);
    }
    expect(names(body)).toContain('Karachi Biryani House');
    expect(names(body)).not.toContain('Model Town Grocers');
  });

  it('filters by priceLevel', async () => {
    const res = await search('?priceLevel=ONE').expect(200);
    expect(names(res.body as SearchResponseBody)).toEqual([
      'Model Town Grocers',
      'Round The Clock Pharmacy',
      'Speedy Auto Workshop',
    ]);
  });

  it('filters by features with AND semantics', async () => {
    const res = await search(
      '?features=parking-available,cash-on-delivery',
    ).expect(200);
    expect(names(res.body as SearchResponseBody)).toEqual([
      'Model Town Grocers',
      'Speedy Auto Workshop',
    ]);
  });

  it('openNow always includes the 24-hour fixture and excludes the always-closed fixture', async () => {
    const res = await search('?openNow=true&perPage=50').expect(200);
    const found = names(res.body as SearchResponseBody);
    expect(found).toContain('Round The Clock Pharmacy');
    expect(found).not.toContain('Grand Wedding Hall');
  });

  it('supports a "near me" radius query, nearest first', async () => {
    const res = await search(
      '?lat=24.8138&lng=67.0299&radius=5000&sort=distance',
    ).expect(200);
    const body = res.body as SearchResponseBody;
    expect(names(body)).toEqual([
      'Karachi Biryani House',
      'Speedy Auto Workshop',
    ]);
    expect(body.data[0]?.name).toBe('Karachi Biryani House');
    expect(body.data[0]?.distanceMeters).toBe(0);
    expect(body.data[1]?.distanceMeters).toBeGreaterThan(0);
  });

  it('rejects sort=distance without lat/lng', async () => {
    await search('?sort=distance').expect(400);
  });

  it('rejects perPage above the hard max of 50', async () => {
    await search('?perPage=100').expect(400);
  });

  it('sort=newest matches descending createdAt order', async () => {
    const expected = await prisma.business.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      select: { name: true },
    });

    const res = await search('?sort=newest&perPage=50').expect(200);
    const body = res.body as SearchResponseBody;
    expect(body.data.map((row) => row.name)).toEqual(
      expected.map((row) => row.name),
    );
  });

  it('paginates with the requested perPage', async () => {
    const first = await search('?perPage=3&page=1').expect(200);
    const second = await search('?perPage=3&page=2').expect(200);
    const firstBody = first.body as SearchResponseBody;
    const secondBody = second.body as SearchResponseBody;

    expect(firstBody.data).toHaveLength(3);
    expect(secondBody.data).toHaveLength(3);
    expect(firstBody.meta.total).toBe(8);
    expect(names(firstBody)).not.toEqual(names(secondBody));
  });
});
