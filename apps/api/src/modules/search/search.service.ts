import { Injectable } from '@nestjs/common';
import { Prisma, PriceTier } from '@buisnez/database';
import type {
  BusinessSearchQuery,
  BusinessSummary,
  PaginationMeta,
} from '@buisnez/shared';
import { DEFAULT_SEARCH_RADIUS_METERS } from '@buisnez/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CategoriesService } from '../categories/categories.service';
import { GeoService } from '../geo/geo.service';
import { getKarachiNow } from './karachi-time.util';
import { weightedRatingSql } from './rating-sql.util';

interface BusinessRow {
  id: string;
  slug: string;
  name: string;
  priceTier: PriceTier | null;
  isVerified: boolean;
  categoryName: string;
  categorySlug: string;
  cityName: string;
  citySlug: string;
  areaName: string | null;
  areaSlug: string | null;
  reviewCount: number;
  avgRating: number | null;
  thumbnailUrl: string | null;
  distanceMeters: number | null;
  isOpenNow: boolean;
  lat: number | null;
  lng: number | null;
}

const REVIEW_COUNT_EXPR = Prisma.sql`COALESCE(rv."reviewCount", 0)`;
const AVG_RATING_EXPR = Prisma.sql`rv."avgRating"`;

const BASE_SELECT_COLUMNS = Prisma.sql`
  b."id" AS id,
  b."slug" AS slug,
  b."name" AS name,
  b."priceTier" AS "priceTier",
  b."isVerified" AS "isVerified",
  category."name" AS "categoryName",
  category."slug" AS "categorySlug",
  city."name" AS "cityName",
  city."slug" AS "citySlug",
  area."name" AS "areaName",
  area."slug" AS "areaSlug",
  ${REVIEW_COUNT_EXPR} AS "reviewCount",
  ${AVG_RATING_EXPR} AS "avgRating",
  thumb."url" AS "thumbnailUrl",
  ST_Y(b."location"::geometry) AS lat,
  ST_X(b."location"::geometry) AS lng
`;

const BASE_FROM = Prisma.sql`
  FROM "Business" b
  JOIN "City" city ON city."id" = b."cityId"
  JOIN "Province" province ON province."id" = b."provinceId"
  LEFT JOIN "Area" area ON area."id" = b."areaId"
  JOIN "Category" category ON category."id" = b."categoryId"
  LEFT JOIN (
    SELECT "businessId", COUNT(*)::int AS "reviewCount", AVG("rating")::float AS "avgRating"
    FROM "Review"
    WHERE "status" = 'PUBLISHED'
    GROUP BY "businessId"
  ) rv ON rv."businessId" = b."id"
  LEFT JOIN LATERAL (
    SELECT "url" FROM "Photo" p
    WHERE p."businessId" = b."id" AND p."status" = 'APPROVED'
    ORDER BY p."createdAt" ASC
    LIMIT 1
  ) thumb ON true
`;

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geoService: GeoService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async search(
    query: BusinessSearchQuery,
  ): Promise<{ data: BusinessSummary[]; meta: PaginationMeta }> {
    const empty = {
      data: [],
      meta: { page: query.page, perPage: query.perPage, total: 0 },
    };

    let categoryIds: string[] | undefined;
    if (query.category) {
      const resolved =
        await this.categoriesService.resolveDescendantCategoryIdsBySlug(
          query.category,
        );
      if (!resolved) {
        return empty;
      }
      categoryIds = resolved;
    }

    const hasGeo = query.lat !== undefined && query.lng !== undefined;
    const effectiveRadius = query.radius ?? DEFAULT_SEARCH_RADIUS_METERS;

    const conditions: Prisma.Sql[] = [
      Prisma.sql`b."status" = 'PUBLISHED'`,
      Prisma.sql`b."deletedAt" IS NULL`,
    ];
    if (query.q) {
      conditions.push(
        Prisma.sql`(b."searchVector" @@ plainto_tsquery('english', ${query.q}) OR similarity(b."name", ${query.q}) > 0.3)`,
      );
    }
    if (categoryIds) {
      conditions.push(Prisma.sql`b."categoryId" = ANY(${categoryIds}::text[])`);
    }
    if (query.province) {
      conditions.push(Prisma.sql`province."slug" = ${query.province}`);
    }
    if (query.city) {
      conditions.push(Prisma.sql`city."slug" = ${query.city}`);
    }
    if (query.area) {
      conditions.push(Prisma.sql`area."slug" = ${query.area}`);
    }
    if (query.minRating !== undefined) {
      conditions.push(
        Prisma.sql`COALESCE(${AVG_RATING_EXPR}, 0) >= ${query.minRating}`,
      );
    }
    if (query.priceLevel?.length) {
      conditions.push(
        Prisma.sql`b."priceTier" = ANY(${query.priceLevel}::"PriceTier"[])`,
      );
    }
    if (query.features?.length) {
      conditions.push(Prisma.sql`(
        SELECT COUNT(*) FROM "BusinessFeature" bf
        JOIN "Feature" f ON f."id" = bf."featureId"
        WHERE bf."businessId" = b."id" AND f."slug" = ANY(${query.features}::text[])
      ) = ${query.features.length}`);
    }
    if (query.openNow) {
      conditions.push(this.openNowExpr());
    }
    if (hasGeo) {
      conditions.push(Prisma.sql`b."location" IS NOT NULL`);
      conditions.push(
        this.geoService.withinRadiusCondition(
          query.lat as number,
          query.lng as number,
          effectiveRadius,
        ),
      );
    }

    const distanceExpr = hasGeo
      ? this.geoService.distanceMetersExpr(
          query.lat as number,
          query.lng as number,
        )
      : Prisma.sql`NULL::float`;
    const relevanceExpr = this.relevanceExpr(
      query.q,
      hasGeo,
      distanceExpr,
      effectiveRadius,
    );
    const whereSql = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
    const offset = (query.page - 1) * query.perPage;

    const [countRows, dataRows] = await Promise.all([
      this.prisma.$queryRaw<{ total: number }[]>(
        Prisma.sql`SELECT COUNT(*)::int AS total ${BASE_FROM} ${whereSql}`,
      ),
      this.prisma.$queryRaw<BusinessRow[]>(Prisma.sql`
        SELECT ${BASE_SELECT_COLUMNS}, ${distanceExpr} AS "distanceMeters", ${relevanceExpr} AS "relevanceScore", ${this.openNowExpr()} AS "isOpenNow"
        ${BASE_FROM}
        ${whereSql}
        ORDER BY ${this.orderBySql(query.sort)}
        LIMIT ${query.perPage} OFFSET ${offset}
      `),
    ]);

    return {
      data: dataRows.map((row) => this.mapRow(row)),
      meta: {
        page: query.page,
        perPage: query.perPage,
        total: countRows[0]?.total ?? 0,
      },
    };
  }

  async listTrending(limit: number): Promise<BusinessSummary[]> {
    const rows = await this.prisma.$queryRaw<BusinessRow[]>(Prisma.sql`
      SELECT ${BASE_SELECT_COLUMNS}, NULL::float AS "distanceMeters", ${this.openNowExpr()} AS "isOpenNow"
      ${BASE_FROM}
      WHERE b."status" = 'PUBLISHED' AND b."deletedAt" IS NULL
      ORDER BY b."viewCount" DESC
      LIMIT ${limit}
    `);
    return rows.map((row) => this.mapRow(row));
  }

  async listHighlyRated(
    limit: number,
    minReviews = 3,
  ): Promise<BusinessSummary[]> {
    const weighted = weightedRatingSql(REVIEW_COUNT_EXPR, AVG_RATING_EXPR);
    const rows = await this.prisma.$queryRaw<BusinessRow[]>(Prisma.sql`
      SELECT ${BASE_SELECT_COLUMNS}, NULL::float AS "distanceMeters", ${this.openNowExpr()} AS "isOpenNow"
      ${BASE_FROM}
      WHERE b."status" = 'PUBLISHED' AND b."deletedAt" IS NULL AND ${REVIEW_COUNT_EXPR} >= ${minReviews}
      ORDER BY ${weighted} DESC
      LIMIT ${limit}
    `);
    return rows.map((row) => this.mapRow(row));
  }

  async listFeatured(limit: number): Promise<BusinessSummary[]> {
    const rows = await this.prisma.$queryRaw<BusinessRow[]>(Prisma.sql`
      SELECT ${BASE_SELECT_COLUMNS}, NULL::float AS "distanceMeters", ${this.openNowExpr()} AS "isOpenNow"
      ${BASE_FROM}
      WHERE b."status" = 'PUBLISHED' AND b."deletedAt" IS NULL AND b."featured" = true AND (b."featuredFrom" IS NULL OR b."featuredFrom" <= now()) AND (b."featuredUntil" IS NULL OR b."featuredUntil" >= now())
      ORDER BY b."createdAt" DESC
      LIMIT ${limit}
    `);
    return rows.map((row) => this.mapRow(row));
  }

  async listRecent(limit: number): Promise<BusinessSummary[]> {
    const rows = await this.prisma.$queryRaw<BusinessRow[]>(Prisma.sql`
      SELECT ${BASE_SELECT_COLUMNS}, NULL::float AS "distanceMeters", ${this.openNowExpr()} AS "isOpenNow"
      ${BASE_FROM}
      WHERE b."status" = 'PUBLISHED' AND b."deletedAt" IS NULL
      ORDER BY b."createdAt" DESC
      LIMIT ${limit}
    `);
    return rows.map((row) => this.mapRow(row));
  }

  /**
   * Same leaf category + same city first (best match), ordered by weighted rating; if that yields fewer
   * than `limit`, broadens to the category's siblings (same parent) in the same city to fill the rest.
   * See docs/06-api-endpoints.md.
   */
  async listSimilar(
    input: {
      businessId: string;
      categoryId: string;
      cityId: string;
      parentCategoryId: string | null;
    },
    limit: number,
  ): Promise<BusinessSummary[]> {
    const weighted = weightedRatingSql(REVIEW_COUNT_EXPR, AVG_RATING_EXPR);

    const sameCategory = await this.prisma.$queryRaw<BusinessRow[]>(Prisma.sql`
      SELECT ${BASE_SELECT_COLUMNS}, NULL::float AS "distanceMeters", ${this.openNowExpr()} AS "isOpenNow"
      ${BASE_FROM}
      WHERE b."status" = 'PUBLISHED' AND b."deletedAt" IS NULL
        AND b."id" != ${input.businessId}
        AND b."categoryId" = ${input.categoryId}
        AND b."cityId" = ${input.cityId}
      ORDER BY ${weighted} DESC
      LIMIT ${limit}
    `);

    const remaining = limit - sameCategory.length;
    if (remaining <= 0 || !input.parentCategoryId) {
      return sameCategory.map((row) => this.mapRow(row));
    }

    const excludeIds = [input.businessId, ...sameCategory.map((row) => row.id)];
    const siblings = await this.prisma.$queryRaw<BusinessRow[]>(Prisma.sql`
      SELECT ${BASE_SELECT_COLUMNS}, NULL::float AS "distanceMeters", ${this.openNowExpr()} AS "isOpenNow"
      ${BASE_FROM}
      WHERE b."status" = 'PUBLISHED' AND b."deletedAt" IS NULL
        AND b."id" != ALL(${excludeIds}::text[])
        AND category."parentId" = ${input.parentCategoryId}
        AND b."cityId" = ${input.cityId}
      ORDER BY ${weighted} DESC
      LIMIT ${remaining}
    `);

    return [...sameCategory, ...siblings].map((row) => this.mapRow(row));
  }

  /** Reused both as a WHERE filter (openNow=true) and as a SELECT column ("isOpenNow"). */
  /** Businesses by id, in the given order (e.g. a favorites list ordered by favorited-at). */
  async listByIds(businessIds: string[]): Promise<BusinessSummary[]> {
    if (businessIds.length === 0) {
      return [];
    }
    const rows = await this.prisma.$queryRaw<BusinessRow[]>(Prisma.sql`
      SELECT ${BASE_SELECT_COLUMNS}, NULL::float AS "distanceMeters", ${this.openNowExpr()} AS "isOpenNow"
      ${BASE_FROM}
      WHERE b."status" = 'PUBLISHED' AND b."deletedAt" IS NULL AND b."id" = ANY(${businessIds}::text[])
    `);
    const byId = new Map(rows.map((row) => [row.id, this.mapRow(row)]));
    return businessIds
      .map((id) => byId.get(id))
      .filter((business): business is BusinessSummary => Boolean(business));
  }

  private openNowExpr(): Prisma.Sql {
    const now = getKarachiNow();
    return Prisma.sql`EXISTS (
      SELECT 1 FROM "BusinessHours" bh
      WHERE bh."businessId" = b."id" AND bh."isClosed" = false AND (
        (bh."dayOfWeek" = ${now.todayDow}::"DayOfWeek" AND bh."opensAt" <= bh."closesAt" AND ${now.nowTime} BETWEEN bh."opensAt" AND bh."closesAt")
        OR (bh."dayOfWeek" = ${now.todayDow}::"DayOfWeek" AND bh."opensAt" > bh."closesAt" AND ${now.nowTime} >= bh."opensAt")
        OR (bh."dayOfWeek" = ${now.yesterdayDow}::"DayOfWeek" AND bh."opensAt" > bh."closesAt" AND ${now.nowTime} <= bh."closesAt")
      )
    )`;
  }

  /** Relevance formula weights — see docs/09-search-discovery.md. Keep both in sync. */
  private relevanceExpr(
    q: string | undefined,
    hasGeo: boolean,
    distanceExpr: Prisma.Sql,
    effectiveRadius: number,
  ): Prisma.Sql {
    const textMatchExpr = q
      ? Prisma.sql`GREATEST(ts_rank_cd(b."searchVector", plainto_tsquery('english', ${q})), similarity(b."name", ${q}))`
      : Prisma.sql`0`;
    const popularityExpr = Prisma.sql`(LN(1 + ${REVIEW_COUNT_EXPR}) / LN(101))`;
    const verifiedBoostExpr = Prisma.sql`(CASE WHEN b."isVerified" THEN 1 ELSE 0 END)`;
    const proximityExpr = hasGeo
      ? Prisma.sql`GREATEST(0, 1 - (${distanceExpr}) / ${effectiveRadius}::float)`
      : Prisma.sql`0`;
    const weighted = weightedRatingSql(REVIEW_COUNT_EXPR, AVG_RATING_EXPR);

    return Prisma.sql`(
      0.45 * ${textMatchExpr}
      + 0.25 * (${weighted} / 5.0)
      + 0.15 * ${popularityExpr}
      + 0.05 * ${verifiedBoostExpr}
      + 0.10 * ${proximityExpr}
    )`;
  }

  private orderBySql(sort: BusinessSearchQuery['sort']): Prisma.Sql {
    switch (sort) {
      case 'rating':
        return Prisma.sql`"avgRating" DESC NULLS LAST, "reviewCount" DESC`;
      case 'distance':
        return Prisma.sql`"distanceMeters" ASC`;
      case 'reviews':
        return Prisma.sql`"reviewCount" DESC`;
      case 'newest':
        return Prisma.sql`b."createdAt" DESC`;
      case 'relevance':
      default:
        return Prisma.sql`"relevanceScore" DESC`;
    }
  }

  private mapRow(row: BusinessRow): BusinessSummary {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      priceTier: row.priceTier,
      isVerified: row.isVerified,
      category: { name: row.categoryName, slug: row.categorySlug },
      city: { name: row.cityName, slug: row.citySlug },
      area:
        row.areaName && row.areaSlug
          ? { name: row.areaName, slug: row.areaSlug }
          : null,
      averageRating:
        row.avgRating !== null ? Math.round(row.avgRating * 10) / 10 : null,
      reviewCount: row.reviewCount,
      thumbnailUrl: row.thumbnailUrl,
      distanceMeters:
        row.distanceMeters !== null ? Math.round(row.distanceMeters) : null,
      isOpenNow: row.isOpenNow,
      location:
        row.lat !== null && row.lng !== null
          ? { lat: row.lat, lng: row.lng }
          : null,
    };
  }
}
