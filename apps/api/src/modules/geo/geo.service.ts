import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@buisnez/database';
import type { GeoPoint } from '@buisnez/shared';
import type { Redis } from 'ioredis';
import { Env } from '../../config/env.schema';
import { REDIS_CLIENT } from '../../integrations/redis/redis.constants';
import { PrismaService } from '../../prisma/prisma.service';

const GEOCODE_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;

interface GoogleGeocodeResponse {
  status: string;
  results: { geometry: { location: { lat: number; lng: number } } }[];
}

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);
  private readonly apiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.apiKey = this.config.get('GOOGLE_MAPS_API_KEY', { infer: true });
    if (!this.apiKey) {
      this.logger.warn(
        'GOOGLE_MAPS_API_KEY is not set — geocodeAddress() is stubbed and returns null.',
      );
    }
  }

  /**
   * Business ids within `radiusMeters` of (lat, lng), nearest first.
   * Uses the GIST index on Business.location via ST_DWithin.
   */
  async findBusinessIdsNear(
    lat: number,
    lng: number,
    radiusMeters: number,
  ): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "Business"
      WHERE "location" IS NOT NULL
        AND ST_DWithin(
          "location",
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          ${radiusMeters}
        )
      ORDER BY "location" <-> ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
    `;
    return rows.map((row) => row.id);
  }

  /** A `Prisma.Sql` fragment for a `WHERE` clause: is `"location"` within `radiusMeters` of (lat, lng). */
  withinRadiusCondition(
    lat: number,
    lng: number,
    radiusMeters: number,
  ): Prisma.Sql {
    return Prisma.sql`ST_DWithin("location", ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radiusMeters})`;
  }

  /** A `Prisma.Sql` fragment for a `SELECT`/`ORDER BY`: distance in meters from `"location"` to (lat, lng). */
  distanceMetersExpr(lat: number, lng: number): Prisma.Sql {
    return Prisma.sql`ST_Distance("location", ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography)`;
  }

  /**
   * Geocodes `address` via the Google Geocoding API (`region=pk`), Redis-cached for 30 days.
   * Returns `null` when `GOOGLE_MAPS_API_KEY` is unset (stubbed — no key has been issued yet) or when the
   * address can't be resolved. Intended for "geocode on write" once business mutation endpoints exist.
   */
  async geocodeAddress(address: string): Promise<GeoPoint | null> {
    if (!this.apiKey) {
      return null;
    }

    const cacheKey = this.geocodeCacheKey(address);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as GeoPoint;
    }

    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', address);
    url.searchParams.set('region', 'pk');
    url.searchParams.set('key', this.apiKey);

    const response = await fetch(url).catch((error: unknown) => {
      this.logger.error(`Geocoding request failed: ${String(error)}`);
      return null;
    });
    if (!response?.ok) {
      return null;
    }

    const body = (await response.json()) as GoogleGeocodeResponse;
    const location = body.results[0]?.geometry.location;
    if (body.status !== 'OK' || !location) {
      return null;
    }

    const point: GeoPoint = { lat: location.lat, lng: location.lng };
    await this.redis.set(
      cacheKey,
      JSON.stringify(point),
      'EX',
      GEOCODE_CACHE_TTL_SECONDS,
    );
    return point;
  }

  /** Sets a business's coordinate — the pin-drop write path (see `BusinessOwnerController`'s location route). */
  async setBusinessLocation(
    businessId: string,
    lat: number,
    lng: number,
  ): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "Business"
      SET "location" = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      WHERE "id" = ${businessId}
    `;
  }

  /** A business's coordinate as `{ lat, lng }`, or `null` if unset. */
  async getBusinessLocation(businessId: string): Promise<GeoPoint | null> {
    const rows = await this.prisma.$queryRaw<{ lat: number; lng: number }[]>`
      SELECT ST_Y("location"::geometry) AS lat, ST_X("location"::geometry) AS lng
      FROM "Business"
      WHERE "id" = ${businessId} AND "location" IS NOT NULL
    `;
    return rows[0] ?? null;
  }

  /** Sets a city's centroid — the taxonomy-admin write path (mirrors `setBusinessLocation`). */
  async setCityCentroid(
    cityId: string,
    lat: number,
    lng: number,
  ): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "City"
      SET "centroid" = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      WHERE "id" = ${cityId}
    `;
  }

  /** A city's centroid as `{ lat, lng }`, or `null` if unset. */
  async getCityCentroid(cityId: string): Promise<GeoPoint | null> {
    const rows = await this.prisma.$queryRaw<{ lat: number; lng: number }[]>`
      SELECT ST_Y("centroid"::geometry) AS lat, ST_X("centroid"::geometry) AS lng
      FROM "City"
      WHERE "id" = ${cityId} AND "centroid" IS NOT NULL
    `;
    return rows[0] ?? null;
  }

  private geocodeCacheKey(address: string): string {
    const normalized = address.toLowerCase().trim().replace(/\s+/g, ' ');
    return `geocode:${createHash('sha256').update(normalized).digest('hex')}`;
  }
}
