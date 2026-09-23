import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GeoService } from '../src/modules/geo/geo.service';

describe('Geo / PostGIS ST_DWithin (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let geoService: GeoService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    geoService = app.get(GeoService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('finds the nearest seeded business within a small radius', async () => {
    const karachiBiryaniHouse = await prisma.business.findUniqueOrThrow({
      where: { slug: 'karachi-biryani-house' },
    });

    const ids = await geoService.findBusinessIdsNear(24.8138, 67.0299, 500);

    expect(ids[0]).toBe(karachiBiryaniHouse.id);
  });

  it('widens the radius to pick up a second nearby seeded business, nearest first', async () => {
    const karachiBiryaniHouse = await prisma.business.findUniqueOrThrow({
      where: { slug: 'karachi-biryani-house' },
    });
    const speedyAutoWorkshop = await prisma.business.findUniqueOrThrow({
      where: { slug: 'speedy-auto-workshop' },
    });

    const ids = await geoService.findBusinessIdsNear(24.8138, 67.0299, 5000);

    expect(ids).toContain(karachiBiryaniHouse.id);
    expect(ids).toContain(speedyAutoWorkshop.id);
    expect(ids.indexOf(karachiBiryaniHouse.id)).toBeLessThan(
      ids.indexOf(speedyAutoWorkshop.id),
    );
  });

  it('excludes businesses outside the radius', async () => {
    // Gilgit: no seeded business is anywhere near this point.
    const ids = await geoService.findBusinessIdsNear(35.9208, 74.3144, 5000);

    expect(ids).toEqual([]);
  });
});
