import { Injectable } from '@nestjs/common';
import { Role } from '@buisnez/database';
import type { ListAdminUsersQuery } from '@buisnez/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { TokenService } from '../../modules/auth/token.service';
import {
  ModerationLogService,
  MODERATION_ACTIONS,
} from '../../integrations/moderation/moderation-log.service';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly moderationLog: ModerationLogService,
  ) {}

  async list(query: ListAdminUsersQuery) {
    const where = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { email: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isBanned: true,
          emailVerifiedAt: true,
          createdAt: true,
          _count: { select: { reviews: true, businesses: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
    ]);
    return {
      data: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isBanned: u.isBanned,
        emailVerifiedAt: u.emailVerifiedAt,
        createdAt: u.createdAt,
        reviewCount: u._count.reviews,
        businessOwnershipCount: u._count.businesses,
      })),
      meta: { page: query.page, perPage: query.perPage, total },
    };
  }

  async getById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        reviews: { take: 20, orderBy: { createdAt: 'desc' } },
        photos: { take: 20, orderBy: { createdAt: 'desc' } },
        businesses: true,
        claims: true,
        _count: { select: { favorites: true } },
      },
    });
    if (!user) {
      throw new AppException(404, 'NOT_FOUND', 'User not found');
    }
    return user;
  }

  async ban(id: string, actorId: string, reason: string) {
    const user = await this.assertExists(id);
    if (user.role === Role.ADMIN) {
      throw new AppException(
        400,
        'CANNOT_BAN_ADMIN',
        'Cannot ban an ADMIN account',
      );
    }
    await this.prisma.user.update({
      where: { id },
      data: { isBanned: true, bannedAt: new Date() },
    });
    await this.tokenService.banUser(id);
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.USER_BANNED,
      targetType: 'USER',
      targetId: id,
      reason,
    });
    return this.getById(id);
  }

  async unban(id: string, actorId: string) {
    await this.assertExists(id);
    await this.prisma.user.update({
      where: { id },
      data: { isBanned: false, bannedAt: null },
    });
    await this.tokenService.unbanUser(id);
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.USER_UNBANNED,
      targetType: 'USER',
      targetId: id,
    });
    return this.getById(id);
  }

  async changeRole(id: string, actorId: string, role: Role) {
    const user = await this.assertExists(id);
    await this.prisma.user.update({ where: { id }, data: { role } });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.USER_ROLE_CHANGED,
      targetType: 'USER',
      targetId: id,
      metadata: { fromRole: user.role, toRole: role },
    });
    return this.getById(id);
  }

  private async assertExists(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppException(404, 'NOT_FOUND', 'User not found');
    }
    return user;
  }
}
