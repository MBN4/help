import { Injectable } from '@nestjs/common';
import type {
  BusinessPhoto,
  BusinessProfile,
  BusinessReview,
  BusinessSummary,
  PaginationMeta,
  SubRatings,
} from '@buisnez/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { GeoService } from '../geo/geo.service';
import { SearchService } from '../search/search.service';
import {
  DAY_ORDER,
  computeIsOpenNow,
  getBusinessAggregates,
} from './business-profile.util';
import {
  getReviewerStatsBulk,
  isVerifiedReviewer,
} from '../users/reviewer-trust.util';

@Injectable()
export class BusinessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geoService: GeoService,
    private readonly searchService: SearchService,
  ) {}

  async getProfileBySlug(slug: string): Promise<BusinessProfile> {
    const business = await this.prisma.business.findFirst({
      where: { slug, status: 'PUBLISHED', deletedAt: null },
      include: {
        category: { include: { parent: true } },
        province: true,
        city: true,
        area: true,
        hours: true,
        features: { include: { feature: true } },
        services: {
          where: { isAvailable: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!business) {
      throw new AppException(404, 'NOT_FOUND', 'Business not found');
    }

    const [location, aggregates] = await Promise.all([
      this.geoService.getBusinessLocation(business.id),
      getBusinessAggregates(this.prisma, business.id),
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
      isOpenNow: computeIsOpenNow(hours),
      features: business.features.map(({ feature }) => ({
        id: feature.id,
        name: feature.name,
        slug: feature.slug,
        icon: feature.icon,
      })),
      aggregates,
      services: business.services.map((service) => ({
        id: service.id,
        businessId: service.businessId,
        name: service.name,
        description: service.description,
        priceInPaisa: service.priceInPaisa,
        isAvailable: service.isAvailable,
        sortOrder: service.sortOrder,
        createdAt: service.createdAt.toISOString(),
      })),
      isClaimed: business.ownerId !== null,
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
          user: { select: { id: true, name: true, avatarUrl: true } },
          photos: { select: { url: true } },
          _count: { select: { helpfulVotes: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    const statsByUser = await getReviewerStatsBulk(
      this.prisma,
      reviews.map((review) => review.user.id),
    );

    return {
      data: reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        subRatings: review.subRatings as SubRatings | null,
        title: review.title,
        body: review.body,
        userId: review.user.id,
        userName: review.user.name,
        userAvatarUrl: review.user.avatarUrl,
        isVerifiedReviewer: isVerifiedReviewer(
          statsByUser.get(review.user.id) ?? {
            reviewCount: 0,
            photoCount: 0,
            helpfulVotesReceived: 0,
          },
        ),
        ownerReply: review.ownerReply,
        ownerReplyAt: review.ownerReplyAt
          ? review.ownerReplyAt.toISOString()
          : null,
        createdAt: review.createdAt.toISOString(),
        photoUrls: review.photos.map((photo) => photo.url),
        helpfulCount: review._count.helpfulVotes,
        status: review.status,
        moderationReason: review.moderationReason,
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

    const where = { businessId, status: 'APPROVED' as const };
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
        thumbUrl: photo.thumbUrl,
        cardUrl: photo.cardUrl,
        caption: photo.caption,
        createdAt: photo.createdAt.toISOString(),
      })),
      meta: { page, perPage, total },
    };
  }

  async getSimilar(slug: string, limit = 6): Promise<BusinessSummary[]> {
    const business = await this.prisma.business.findFirst({
      where: { slug, status: 'PUBLISHED', deletedAt: null },
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
      where: { id: businessId, status: 'PUBLISHED', deletedAt: null },
      select: { id: true },
    });
    if (!business) {
      throw new AppException(404, 'NOT_FOUND', 'Business not found');
    }
  }
}
