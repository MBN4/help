import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Role } from '@buisnez/database';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../exceptions/app.exception';
import { RequestUser } from '../decorators/current-user.decorator';

/**
 * Per the Phase 6 ground truth: "business owner" authorization is per-business, never role-based.
 * `Business.ownerId` is the source of truth — `Role.BUSINESS_OWNER` is cosmetic/display only and is never
 * read here. Every route this guard protects must use a `:businessId` uuid path param. Runs after
 * `JwtAuthGuard` (so `request.user` is already populated), applied route-scoped (not global).
 */
@Injectable()
export class BusinessOwnerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();
    if (!request.user) {
      throw new AppException(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const businessId = request.params.businessId as string;
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    });
    if (!business) {
      throw new AppException(404, 'NOT_FOUND', 'Business not found');
    }
    if (
      business.ownerId !== request.user.id &&
      request.user.role !== Role.ADMIN
    ) {
      throw new AppException(403, 'FORBIDDEN', 'You do not own this business');
    }
    return true;
  }
}
