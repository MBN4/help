import { Injectable } from '@nestjs/common';
import { BusinessStatus } from '@buisnez/database';
import type { AdminDashboard } from '@buisnez/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(): Promise<AdminDashboard> {
    const [
      statusGroups,
      totalUsers,
      totalReviews,
      pendingClaimsCount,
      openReportsCount,
      photosPendingCount,
    ] = await Promise.all([
      this.prisma.business.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.user.count(),
      this.prisma.review.count(),
      this.prisma.claim.count({ where: { status: 'PENDING' } }),
      this.prisma.report.count({ where: { status: 'PENDING' } }),
      this.prisma.photo.count({ where: { status: 'PENDING' } }),
    ]);

    const businessesByStatus = Object.fromEntries(
      Object.values(BusinessStatus).map((status) => [status, 0]),
    ) as Record<BusinessStatus, number>;
    for (const group of statusGroups) {
      businessesByStatus[group.status] = group._count._all;
    }

    return {
      businessesByStatus,
      totalUsers,
      totalReviews,
      pendingClaimsCount,
      openReportsCount,
      photosPendingCount,
    };
  }
}
