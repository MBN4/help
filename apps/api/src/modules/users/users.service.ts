import { Injectable } from '@nestjs/common';
import type {
  AuthUser,
  MyPhoto,
  MyReview,
  PaginationMeta,
  PublicUserProfile,
  SubRatings,
  UpdateProfileRequest,
} from '@buisnez/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { serializeUser } from '../auth/auth.service';
import { getReviewerStats, isVerifiedReviewer } from './reviewer-trust.util';

const RECENT_REVIEWS_LIMIT = 10;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public reviewer profile (Phase 8) — no auth required, never returns email/phone/other private fields. */
  async publicProfile(userId: string): Promise<PublicUserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new AppException(404, 'NOT_FOUND', 'User not found');
    }

    const [stats, reviews] = await Promise.all([
      getReviewerStats(this.prisma, userId),
      this.prisma.review.findMany({
        where: { userId, status: 'PUBLISHED' },
        include: { business: { select: { name: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
        take: RECENT_REVIEWS_LIMIT,
      }),
    ]);

    return {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      memberSince: user.createdAt.toISOString(),
      isVerifiedReviewer: isVerifiedReviewer(stats),
      reviewCount: stats.reviewCount,
      photoCount: stats.photoCount,
      helpfulVotesReceived: stats.helpfulVotesReceived,
      recentReviews: reviews.map((review) => ({
        id: review.id,
        businessName: review.business.name,
        businessSlug: review.business.slug,
        rating: review.rating,
        title: review.title,
        body: review.body,
        createdAt: review.createdAt.toISOString(),
      })),
    };
  }

  async updateProfile(
    userId: string,
    input: UpdateProfileRequest,
  ): Promise<AuthUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.bio !== undefined ? { bio: input.bio } : {}),
        ...(input.avatarUrl !== undefined
          ? { avatarUrl: input.avatarUrl }
          : {}),
      },
    });
    return serializeUser(user);
  }

  async myReviews(
    userId: string,
    page: number,
    perPage: number,
  ): Promise<{ data: MyReview[]; meta: PaginationMeta }> {
    const where = { userId };
    const [total, reviews] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: {
          business: { select: { id: true, name: true, slug: true } },
          photos: { select: { url: true } },
          _count: { select: { helpfulVotes: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return {
      data: reviews.map((review) => ({
        id: review.id,
        business: review.business,
        rating: review.rating,
        subRatings: review.subRatings as SubRatings | null,
        title: review.title,
        body: review.body,
        createdAt: review.createdAt.toISOString(),
        photoUrls: review.photos.map((photo) => photo.url),
        helpfulCount: review._count.helpfulVotes,
        status: review.status,
        moderationReason: review.moderationReason,
      })),
      meta: { page, perPage, total },
    };
  }

  async myPhotos(
    userId: string,
    page: number,
    perPage: number,
  ): Promise<{ data: MyPhoto[]; meta: PaginationMeta }> {
    const where = { userId };
    const [total, photos] = await Promise.all([
      this.prisma.photo.count({ where }),
      this.prisma.photo.findMany({
        where,
        include: { business: { select: { id: true, name: true, slug: true } } },
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
        business: photo.business,
        status: photo.status,
        moderationReason: photo.moderationReason,
      })),
      meta: { page, perPage, total },
    };
  }
}
