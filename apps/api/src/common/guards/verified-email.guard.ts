import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../exceptions/app.exception';
import { RequestUser } from '../decorators/current-user.decorator';

/**
 * Per docs/11-reviews-trust-safety.md: writing a review or uploading a photo requires a verified email.
 * Runs after JwtAuthGuard (so `request.user` is already populated) on the specific routes that need it —
 * not global, since favorites/helpful-votes/reports don't require verification.
 */
@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();
    if (!request.user) {
      throw new AppException(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: request.user.id },
      select: { emailVerifiedAt: true },
    });
    if (!user?.emailVerifiedAt) {
      throw new AppException(
        403,
        'EMAIL_NOT_VERIFIED',
        'Please verify your email address before contributing content',
      );
    }
    return true;
  }
}
