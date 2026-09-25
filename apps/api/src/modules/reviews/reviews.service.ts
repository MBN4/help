import { Injectable } from '@nestjs/common';
import type {
  BusinessReview,
  CreateReviewRequest,
  SubRatings,
} from '@buisnez/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { DiscoveryService } from '../discovery/discovery.service';
import { RevalidateService } from '../../integrations/revalidate/revalidate.service';
import { ModerationService } from '../../integrations/moderation/moderation.service';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly discoveryService: DiscoveryService,
    private readonly revalidateService: RevalidateService,
    private readonly moderationService: ModerationService,
  ) {}

  async createOrUpdate(
    userId: string,
    businessId: string,
    input: CreateReviewRequest,
  ): Promise<BusinessReview> {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, status: 'PUBLISHED' },
      include: {
        city: { select: { slug: true } },
        category: { select: { slug: true } },
      },
    });
    if (!business) {
      throw new AppException(404, 'NOT_FOUND', 'Business not found');
    }

    // Publishes immediately (see docs/11-reviews-trust-safety.md's Phase 5 moderation decision).
    const data = {
      rating: input.rating,
      subRatings: input.subRatings ?? undefined,
      title: input.title ?? null,
      body: input.body ?? null,
    };

    const review = await this.prisma.review.upsert({
      where: { businessId_userId: { businessId, userId } },
      create: { ...data, businessId, userId },
      update: data,
    });

    // No-op-approve seam for Phase 8's real automated flagging/scoring pass — see ModerationService.
    await this.moderationService.enqueue('REVIEW', review.id);

    if (input.photoIds?.length) {
      // Photos are uploaded (and scoped to this business) before the review form is submitted; this just
      // links the ones the user picked to the review itself. Scoped to `userId`/`businessId` so a photo id
      // can't be hijacked onto someone else's review or a different business.
      await this.prisma.photo.updateMany({
        where: {
          id: { in: input.photoIds },
          userId,
          businessId,
          reviewId: null,
        },
        data: { reviewId: review.id },
      });
    }

    // Aggregates are always computed live from `Review` rows (see BusinessesService.getAggregates) — no
    // denormalized counter to update. Only the discovery-block cache and the ISR pages need an explicit bust.
    await this.discoveryService.invalidateHomeCache();
    await this.revalidateService.revalidate({
      slug: business.slug,
      city: business.city.slug,
      category: business.category.slug,
    });

    return this.getOne(review.id);
  }

  async toggleHelpful(
    userId: string,
    reviewId: string,
  ): Promise<{ helpful: boolean; helpfulCount: number }> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) {
      throw new AppException(404, 'NOT_FOUND', 'Review not found');
    }

    const existing = await this.prisma.reviewHelpfulVote.findUnique({
      where: { userId_reviewId: { userId, reviewId } },
    });

    if (existing) {
      await this.prisma.reviewHelpfulVote.delete({
        where: { userId_reviewId: { userId, reviewId } },
      });
    } else {
      await this.prisma.reviewHelpfulVote.create({
        data: { userId, reviewId },
      });
    }

    const helpfulCount = await this.prisma.reviewHelpfulVote.count({
      where: { reviewId },
    });
    return { helpful: !existing, helpfulCount };
  }

  async myReview(
    userId: string,
    businessId: string,
  ): Promise<BusinessReview | null> {
    const review = await this.prisma.review.findUnique({
      where: { businessId_userId: { businessId, userId } },
    });
    return review ? this.getOne(review.id) : null;
  }

  async replyToReview(
    businessId: string,
    reviewId: string,
    reply: string,
  ): Promise<BusinessReview> {
    return this.setOwnerReply(businessId, reviewId, reply);
  }

  async deleteReply(
    businessId: string,
    reviewId: string,
  ): Promise<BusinessReview> {
    return this.setOwnerReply(businessId, reviewId, null);
  }

  private async setOwnerReply(
    businessId: string,
    reviewId: string,
    reply: string | null,
  ): Promise<BusinessReview> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review || review.businessId !== businessId) {
      throw new AppException(404, 'NOT_FOUND', 'Review not found');
    }

    const business = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      include: {
        city: { select: { slug: true } },
        category: { select: { slug: true } },
      },
    });

    await this.prisma.review.update({
      where: { id: reviewId },
      data: { ownerReply: reply, ownerReplyAt: reply ? new Date() : null },
    });

    await this.revalidateService.revalidate({
      slug: business.slug,
      city: business.city.slug,
      category: business.category.slug,
    });

    return this.getOne(reviewId);
  }

  async myHelpfulVotes(userId: string, businessId: string): Promise<string[]> {
    const votes = await this.prisma.reviewHelpfulVote.findMany({
      where: { userId, review: { businessId } },
      select: { reviewId: true },
    });
    return votes.map((vote) => vote.reviewId);
  }

  private async getOne(reviewId: string): Promise<BusinessReview> {
    const review = await this.prisma.review.findUniqueOrThrow({
      where: { id: reviewId },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        photos: { select: { url: true } },
        _count: { select: { helpfulVotes: true } },
      },
    });

    return {
      id: review.id,
      rating: review.rating,
      subRatings: review.subRatings as SubRatings | null,
      title: review.title,
      body: review.body,
      userId: review.user.id,
      userName: review.user.name,
      userAvatarUrl: review.user.avatarUrl,
      ownerReply: review.ownerReply,
      ownerReplyAt: review.ownerReplyAt
        ? review.ownerReplyAt.toISOString()
        : null,
      createdAt: review.createdAt.toISOString(),
      photoUrls: review.photos.map((photo) => photo.url),
      helpfulCount: review._count.helpfulVotes,
    };
  }
}
