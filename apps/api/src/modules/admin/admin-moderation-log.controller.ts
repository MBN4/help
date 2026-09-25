import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@buisnez/database';
import type { ModerationLogQuery } from '@buisnez/shared';
import { moderationLogQuerySchema } from '@buisnez/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('admin/moderation-log')
@Roles(Role.MODERATOR, Role.ADMIN)
export class AdminModerationLogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(moderationLogQuerySchema))
    query: ModerationLogQuery,
  ) {
    const where = {
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.targetId ? { targetId: query.targetId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [total, entries] = await Promise.all([
      this.prisma.moderationLog.count({ where }),
      this.prisma.moderationLog.findMany({
        where,
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
    ]);

    return {
      data: entries.map((entry) => ({
        id: entry.id,
        actorId: entry.actorId,
        actorName: entry.actor.name,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        reason: entry.reason,
        notes: entry.notes,
        metadata: entry.metadata,
        createdAt: entry.createdAt.toISOString(),
      })),
      meta: { page: query.page, perPage: query.perPage, total },
    };
  }
}
