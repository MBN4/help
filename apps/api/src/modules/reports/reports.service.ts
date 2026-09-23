import { Injectable } from '@nestjs/common';
import type { CreateReportRequest } from '@buisnez/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    reporterId: string,
    input: CreateReportRequest,
  ): Promise<{ id: string }> {
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
