import { Injectable } from '@nestjs/common';
import type { ResolveReportRequest } from '@buisnez/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { RevalidateService } from '../../integrations/revalidate/revalidate.service';
import { TokenService } from '../../modules/auth/token.service';
import {
  ModerationLogService,
  MODERATION_ACTIONS,
} from '../../integrations/moderation/moderation-log.service';
import { AdminContentService } from './admin-content.service';

interface ReportRow {
  id: string;
  targetType: string;
  businessId: string | null;
  reviewId: string | null;
  photoId: string | null;
  reportedUserId: string | null;
  reporterId: string;
  reason: string;
  message: string | null;
  status: string;
  createdAt: Date;
}

function targetKey(report: ReportRow): string {
  const targetId =
    report.businessId ??
    report.reviewId ??
    report.photoId ??
    report.reportedUserId ??
    '';
  return `${report.targetType}:${targetId}`;
}

@Injectable()
export class AdminReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationLog: ModerationLogService,
    private readonly revalidateService: RevalidateService,
    private readonly tokenService: TokenService,
    private readonly contentService: AdminContentService,
  ) {}

  /** Grouped/sorted by priority = open-report count per (targetType, targetId), most-reported first. */
  async listGrouped(status: string): Promise<unknown[]> {
    const reports = await this.prisma.report.findMany({
      where: { status: status as never },
      orderBy: { createdAt: 'desc' },
      include: {
        business: { select: { id: true, name: true, slug: true } },
        review: {
          select: {
            id: true,
            body: true,
            rating: true,
            user: { select: { id: true, name: true } },
          },
        },
        photo: {
          select: {
            id: true,
            url: true,
            user: { select: { id: true, name: true } },
          },
        },
        reportedUser: { select: { id: true, name: true, email: true } },
        reporter: { select: { id: true, name: true } },
      },
    });

    const groups = new Map<
      string,
      { count: number; target: unknown; reports: unknown[] }
    >();
    for (const report of reports) {
      const key = targetKey(report);
      const target =
        report.business ??
        report.review ??
        report.photo ??
        report.reportedUser ??
        null;
      const entry = groups.get(key) ?? { count: 0, target, reports: [] };
      entry.count += 1;
      entry.reports.push({
        id: report.id,
        reason: report.reason,
        message: report.message,
        status: report.status,
        createdAt: report.createdAt.toISOString(),
        reporter: report.reporter,
      });
      groups.set(key, entry);
    }

    return [...groups.entries()]
      .map(([key, value]) => {
        const [targetType, targetId] = key.split(':');
        return { targetType, targetId, ...value };
      })
      .sort((a, b) => b.count - a.count);
  }

  async getDetail(id: string): Promise<unknown> {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        business: true,
        review: { include: { user: { select: { id: true, name: true } } } },
        photo: { include: { user: { select: { id: true, name: true } } } },
        reportedUser: { select: { id: true, name: true, email: true } },
        reporter: { select: { id: true, name: true, email: true } },
      },
    });
    if (!report) {
      throw new AppException(404, 'NOT_FOUND', 'Report not found');
    }
    return report;
  }

  async resolve(
    id: string,
    actorId: string,
    input: ResolveReportRequest,
  ): Promise<{ id: string; status: string }> {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: { review: { select: { userId: true } } },
    });
    if (!report) {
      throw new AppException(404, 'NOT_FOUND', 'Report not found');
    }
    if (report.status !== 'PENDING') {
      throw new AppException(
        409,
        'ALREADY_RESOLVED',
        'Report already actioned',
      );
    }

    if (input.action === 'REMOVE_CONTENT') {
      if (report.targetType === 'REVIEW' && report.reviewId) {
        await this.contentService.removeReview(
          report.reviewId,
          actorId,
          input.reason ?? 'Removed via report resolution',
        );
      } else if (report.targetType === 'PHOTO' && report.photoId) {
        await this.contentService.removePhoto(
          report.photoId,
          actorId,
          input.reason ?? 'Removed via report resolution',
        );
      } else {
        throw new AppException(
          400,
          'UNSUPPORTED_ACTION',
          'REMOVE_CONTENT is only supported for REVIEW/PHOTO reports',
        );
      }
    } else if (input.action === 'BAN_USER') {
      const bannedUserId = report.reportedUserId ?? report.review?.userId;
      if (!bannedUserId) {
        throw new AppException(
          400,
          'UNSUPPORTED_ACTION',
          'BAN_USER requires a reportedUserId on the report',
        );
      }
      await this.banUser(
        bannedUserId,
        actorId,
        input.reason ?? 'Banned via report resolution',
      );
    }

    await this.prisma.report.update({
      where: { id },
      data: { status: 'RESOLVED' },
    });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.REPORT_RESOLVED,
      targetType: 'REPORT',
      targetId: id,
      reason: input.reason ?? null,
      metadata: { action: input.action, reportTargetType: report.targetType },
    });

    return { id, status: 'RESOLVED' };
  }

  async dismiss(
    id: string,
    actorId: string,
    reason?: string,
  ): Promise<{ id: string; status: string }> {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) {
      throw new AppException(404, 'NOT_FOUND', 'Report not found');
    }
    await this.prisma.report.update({
      where: { id },
      data: { status: 'DISMISSED' },
    });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.REPORT_DISMISSED,
      targetType: 'REPORT',
      targetId: id,
      reason: reason ?? null,
    });
    return { id, status: 'DISMISSED' };
  }

  private async banUser(
    userId: string,
    actorId: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isBanned: true, bannedAt: new Date() },
    });
    await this.tokenService.banUser(userId);
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.USER_BANNED,
      targetType: 'USER',
      targetId: userId,
      reason,
    });
  }
}
