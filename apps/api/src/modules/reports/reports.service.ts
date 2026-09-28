import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { CreateReportRequest } from '@buisnez/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { REDIS_CLIENT } from '../../integrations/redis/redis.constants';

// Report-bombing guard (Phase 8): independent of the IP-keyed `@Throttle` on the controller (10/min/IP) —
// this is per-user, so one account can't file unlimited reports across many IPs, and one IP with many
// accounts still hits the throttler. See docs/11-reviews-trust-safety.md.
const REPORT_RATE_LIMIT_MAX = 8;
const REPORT_RATE_LIMIT_WINDOW_SECONDS = 60;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async create(
    reporterId: string,
    input: CreateReportRequest,
  ): Promise<{ id: string }> {
    await this.assertNotRateLimited(reporterId);
    await this.assertTargetExists(input.targetType, input.targetId);

    const report = await this.prisma.report.create({
      data: {
        targetType: input.targetType,
        reason: input.reason,
        message: input.message ?? null,
        reporterId,
        businessId: input.targetType === 'BUSINESS' ? input.targetId : null,
        reviewId: input.targetType === 'REVIEW' ? input.targetId : null,
        photoId: input.targetType === 'PHOTO' ? input.targetId : null,
        reportedUserId: input.targetType === 'USER' ? input.targetId : null,
      },
      select: { id: true },
    });
    return report;
  }

  /**
   * Phase 8 "recourse" path: the content's own author appeals a hold/removal. Reuses the Report model
   * (reason: 'APPEAL') and the same admin reports queue, rather than a separate appeals system — see
   * docs/11-reviews-trust-safety.md. Only the actual author of the target review/photo may file one, and
   * only while it's currently PENDING or REMOVED (nothing to appeal about published content).
   */
  async createAppeal(
    userId: string,
    targetType: 'REVIEW' | 'PHOTO',
    targetId: string,
    message: string | undefined,
  ): Promise<{ id: string }> {
    await this.assertNotRateLimited(userId);

    if (targetType === 'REVIEW') {
      const review = await this.prisma.review.findUnique({
        where: { id: targetId },
        select: { userId: true, status: true },
      });
      if (!review || review.userId !== userId) {
        throw new AppException(404, 'NOT_FOUND', 'Review not found');
      }
      if (review.status === 'PUBLISHED') {
        throw new AppException(
          409,
          'NOT_HELD',
          'This review is already visible — nothing to appeal',
        );
      }
    } else {
      const photo = await this.prisma.photo.findUnique({
        where: { id: targetId },
        select: { userId: true, status: true },
      });
      if (!photo || photo.userId !== userId) {
        throw new AppException(404, 'NOT_FOUND', 'Photo not found');
      }
      if (photo.status === 'APPROVED') {
        throw new AppException(
          409,
          'NOT_HELD',
          'This photo is already visible — nothing to appeal',
        );
      }
    }

    const report = await this.prisma.report.create({
      data: {
        targetType,
        reason: 'APPEAL',
        message: message ?? null,
        reporterId: userId,
        reviewId: targetType === 'REVIEW' ? targetId : null,
        photoId: targetType === 'PHOTO' ? targetId : null,
      },
      select: { id: true },
    });
    return report;
  }

  private async assertNotRateLimited(userId: string): Promise<void> {
    const key = `report:count:${userId}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, REPORT_RATE_LIMIT_WINDOW_SECONDS);
    }
    if (count > REPORT_RATE_LIMIT_MAX) {
      throw new AppException(
        429,
        'RATE_LIMITED',
        'Too many reports — please slow down and try again shortly',
      );
    }
  }

  private async assertTargetExists(
    targetType: CreateReportRequest['targetType'],
    targetId: string,
  ): Promise<void> {
    const exists = await (() => {
      switch (targetType) {
        case 'BUSINESS':
          return this.prisma.business.findUnique({
            where: { id: targetId },
            select: { id: true },
          });
        case 'REVIEW':
          return this.prisma.review.findUnique({
            where: { id: targetId },
            select: { id: true },
          });
        case 'PHOTO':
          return this.prisma.photo.findUnique({
            where: { id: targetId },
            select: { id: true },
          });
        case 'USER':
          return this.prisma.user.findUnique({
            where: { id: targetId },
            select: { id: true },
          });
      }
    })();
    if (!exists) {
      throw new AppException(
        404,
        'NOT_FOUND',
        `${targetType.toLowerCase()} not found`,
      );
    }
  }
}
