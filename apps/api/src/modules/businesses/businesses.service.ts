import { Injectable } from '@nestjs/common';
import type {
  BusinessPhoto,
  BusinessProfile,
  BusinessReview,
  BusinessSummary,
  DayOfWeek,
  PaginationMeta,
  RatingBreakdown,
} from '@buisnez/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { GeoService } from '../geo/geo.service';
import { SearchService } from '../search/search.service';

const DAY_ORDER: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

@Injectable()
export class BusinessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geoService: GeoService,
    private readonly searchService: SearchService,
  ) {}

  async getProfileBySlug(slug: string): Promise<BusinessProfile> {
    const business = await this.prisma.business.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: {
        category: { include: { parent: true } },
        province: true,
        city: true,
        area: true,
        hours: true,
        features: { include: { feature: true } },
      },
    });
    if (!business) {
      throw new AppException(404, 'NOT_FOUND', 'Business not found');
    }

    const [location, aggregates] = await Promise.all([
      this.geoService.getBusinessLocation(business.id),
      this.getAggregates(business.id),
    ]);

    const hours = [...business.hours].sort(
      (a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek),
    );

    return {
      id: business.id,
      slug: business.slug,
      name: business.name,
      description: business.description,
      addressLine: business.addressLine,
      location,
      phone: business.phone,
      whatsapp: business.whatsapp,
      email: business.email,
      website: business.website,
      priceTier: business.priceTier,
      isVerified: business.isVerified,
      category: {
        id: business.category.id,
        name: business.category.name,
        slug: business.category.slug,
        parent: business.category.parent
          ? {
              id: business.category.parent.id,
              name: business.category.parent.name,
              slug: business.category.parent.slug,
            }
          : null,
      },
      province: { name: business.province.name, slug: business.province.slug },
      city: { name: business.city.name, slug: business.city.slug },
      area: business.area
        ? { name: business.area.name, slug: business.area.slug }
        : null,
      hours: hours.map((hour) => ({
        dayOfWeek: hour.dayOfWeek,
        opensAt: hour.opensAt,
        closesAt: hour.closesAt,
        isClosed: hour.isClosed,
      })),
      features: business.features.map(({ feature }) => ({
        id: feature.id,
        name: feature.name,
        slug: feature.slug,
        icon: feature.icon,
      })),
      aggregates,
      createdAt: business.createdAt.toISOString(),
    };
  }

  async getReviews(
    businessId: string,
    page: number,
    perPage: number,
  ): Promise<{ data: BusinessReview[]; meta: PaginationMeta }> {
    await this.assertPublishedBusiness(businessId);

    const where = { businessId, status: 'PUBLISHED' as const };
    const [total, reviews] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: {
          user: { select: { name: true } },
          photos: { select: { url: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return {
      data: reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        title: review.title,
        body: review.body,
        userName: review.user.name,
        ownerReply: review.ownerReply,
        ownerReplyAt: review.ownerReplyAt
          ? review.ownerReplyAt.toISOString()
          : null,
        createdAt: review.createdAt.toISOString(),
        photoUrls: review.photos.map((photo) => photo.url),
      })),
      meta: { page, perPage, total },
    };
  }

  async getPhotos(
    businessId: string,
    page: number,
    perPage: number,
  ): Promise<{ data: BusinessPhoto[]; meta: PaginationMeta }> {
    await this.assertPublishedBusiness(businessId);

    const where = { businessId, isApproved: true };
    const [total, photos] = await Promise.all([
      this.prisma.photo.count({ where }),
      this.prisma.photo.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return {
      data: photos.map((photo) => ({
        id: photo.id,
        url: photo.url,
        caption: photo.caption,
        createdAt: photo.createdAt.toISOString(),
      })),
      meta: { page, perPage, total },
    };
  }

  async getSimilar(slug: string, limit = 6): Promise<BusinessSummary[]> {
    const business = await this.prisma.business.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: {
        id: true,
        categoryId: true,
        cityId: true,
        category: { select: { parentId: true } },
      },
    });
    if (!business) {
      throw new AppException(404, 'NOT_FOUND', 'Business not found');
    }

    return this.searchService.listSimilar(
      {
        businessId: business.id,
        categoryId: business.categoryId,
        cityId: business.cityId,
        parentCategoryId: business.category.parentId,
      },
      limit,
    );
  }

  private async assertPublishedBusiness(businessId: string): Promise<void> {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, status: 'PUBLISHED' },
      select: { id: true },
    });
    if (!business) {
      throw new AppException(404, 'NOT_FOUND', 'Business not found');
    }
  }

  private async getAggregates(businessId: string): Promise<{
    averageRating: number | null;
    reviewCount: number;
    ratingBreakdown: RatingBreakdown;
  }> {
    const grouped = await this.prisma.review.groupBy({
      by: ['rating'],
      where: { businessId, status: 'PUBLISHED' },
      _count: { _all: true },
    });

    const ratingBreakdown: RatingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let reviewCount = 0;
    let ratingSum = 0;
    for (const group of grouped) {
      const rating = group.rating as 1 | 2 | 3 | 4 | 5;
      ratingBreakdown[rating] = group._count._all;
      reviewCount += group._count._all;
      ratingSum += rating * group._count._all;
    }

    return {
      averageRating:
        reviewCount > 0
          ? Math.round((ratingSum / reviewCount) * 10) / 10
          : null,
      reviewCount,
      ratingBreakdown,
    };
  }
}
