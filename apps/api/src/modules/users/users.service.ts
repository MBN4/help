import { Injectable } from '@nestjs/common';
import type {
  AuthUser,
  MyPhoto,
  MyReview,
  PaginationMeta,
  SubRatings,
  UpdateProfileRequest,
} from '@buisnez/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { serializeUser } from '../auth/auth.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
      })),
      meta: { page, perPage, total },
    };
  }
}
