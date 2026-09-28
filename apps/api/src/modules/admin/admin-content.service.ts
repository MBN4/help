import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { RevalidateService } from '../../integrations/revalidate/revalidate.service';
import { MailService } from '../../integrations/mail/mail.service';
import {
  ModerationLogService,
  MODERATION_ACTIONS,
} from '../../integrations/moderation/moderation-log.service';

@Injectable()
export class AdminContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationLog: ModerationLogService,
    private readonly revalidateService: RevalidateService,
    private readonly mailService: MailService,
  ) {}

  async listReviews(
    status?: string,
    reportedOnly?: boolean,
  ): Promise<unknown[]> {
    if (reportedOnly) {
      const reportedIds = await this.prisma.report.findMany({
        where: {
          targetType: 'REVIEW',
          status: 'PENDING',
          reviewId: { not: null },
        },
        select: { reviewId: true },
        distinct: ['reviewId'],
      });
      return this.prisma.review.findMany({
        where: { id: { in: reportedIds.map((r) => r.reviewId as string) } },
        include: {
          user: { select: { id: true, name: true } },
          business: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }
    return this.prisma.review.findMany({
      where: status ? { status: status as never } : undefined,
      include: {
        user: { select: { id: true, name: true } },
        business: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listPhotos(
    status?: string,
    reportedOnly?: boolean,
  ): Promise<unknown[]> {
    if (reportedOnly) {
      const reportedIds = await this.prisma.report.findMany({
        where: {
          targetType: 'PHOTO',
          status: 'PENDING',
          photoId: { not: null },
        },
        select: { photoId: true },
        distinct: ['photoId'],
      });
      return this.prisma.photo.findMany({
        where: { id: { in: reportedIds.map((r) => r.photoId as string) } },
        include: {
          user: { select: { id: true, name: true } },
          business: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }
    return this.prisma.photo.findMany({
      where: status ? { status: status as never } : undefined,
      include: {
        user: { select: { id: true, name: true } },
        business: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveReview(id: string, actorId: string): Promise<void> {
    const review = await this.getReviewOrThrow(id);
    await this.prisma.review.update({
      where: { id },
      data: { status: 'PUBLISHED', moderationReason: null },
    });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.REVIEW_APPROVED,
      targetType: 'REVIEW',
      targetId: id,
    });
    await this.revalidateReviewBusiness(review.businessId);
  }

  async removeReview(
    id: string,
    actorId: string,
    reason: string,
  ): Promise<void> {
    const review = await this.getReviewOrThrow(id);
    await this.prisma.review.update({
      where: { id },
      data: { status: 'REMOVED', moderationReason: reason },
    });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.REVIEW_REMOVED,
      targetType: 'REVIEW',
      targetId: id,
      reason,
    });
    await this.notifyOwner(review.userId, 'REVIEW', reason);
    await this.revalidateReviewBusiness(review.businessId);
  }

  async restoreReview(
    id: string,
    actorId: string,
    reason?: string,
  ): Promise<void> {
    const review = await this.getReviewOrThrow(id);
    await this.prisma.review.update({
      where: { id },
      data: { status: 'PUBLISHED', moderationReason: null },
    });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.REVIEW_RESTORED,
      targetType: 'REVIEW',
      targetId: id,
      reason: reason ?? null,
    });
    await this.revalidateReviewBusiness(review.businessId);
  }

  async approvePhoto(id: string, actorId: string): Promise<void> {
    const photo = await this.getPhotoOrThrow(id);
    await this.prisma.photo.update({
      where: { id },
      data: { status: 'APPROVED', moderationReason: null },
    });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.PHOTO_APPROVED,
      targetType: 'PHOTO',
      targetId: id,
    });
    if (photo.businessId) await this.revalidateReviewBusiness(photo.businessId);
  }

  async removePhoto(
    id: string,
    actorId: string,
    reason: string,
  ): Promise<void> {
    const photo = await this.getPhotoOrThrow(id);
    await this.prisma.photo.update({
      where: { id },
      data: { status: 'REMOVED', moderationReason: reason },
    });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.PHOTO_REMOVED,
      targetType: 'PHOTO',
      targetId: id,
      reason,
    });
    await this.notifyOwner(photo.userId, 'PHOTO', reason);
    if (photo.businessId) await this.revalidateReviewBusiness(photo.businessId);
  }

  async restorePhoto(
    id: string,
    actorId: string,
    reason?: string,
  ): Promise<void> {
    const photo = await this.getPhotoOrThrow(id);
    await this.prisma.photo.update({
      where: { id },
      data: { status: 'APPROVED', moderationReason: null },
    });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.PHOTO_RESTORED,
      targetType: 'PHOTO',
      targetId: id,
      reason: reason ?? null,
    });
    if (photo.businessId) await this.revalidateReviewBusiness(photo.businessId);
  }

  private async notifyOwner(
    userId: string,
    targetType: 'REVIEW' | 'PHOTO',
    reason: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (user) {
      this.mailService.notifyContentRemoved(user.email, targetType, reason);
    }
  }

  private async getReviewOrThrow(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) {
      throw new AppException(404, 'NOT_FOUND', 'Review not found');
    }
    return review;
  }

  private async getPhotoOrThrow(id: string) {
    const photo = await this.prisma.photo.findUnique({ where: { id } });
    if (!photo) {
      throw new AppException(404, 'NOT_FOUND', 'Photo not found');
    }
    return photo;
  }

  /** Same revalidation pattern as `ReviewsService.createOrUpdate()`/the owner-reply write path. */
  private async revalidateReviewBusiness(businessId: string): Promise<void> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: {
        city: { select: { slug: true } },
        category: { select: { slug: true } },
      },
    });
    if (!business) return;
    await this.revalidateService.revalidate({
      slug: business.slug,
      city: business.city.slug,
      category: business.category.slug,
    });
  }
}
