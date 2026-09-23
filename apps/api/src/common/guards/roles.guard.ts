import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@buisnez/database';
import type { Request } from 'express';
import { AppException } from '../exceptions/app.exception';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestUser } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();
    const user = request.user;
    if (!user || !requiredRoles.includes(user.role)) {
      throw new AppException(
        403,
        'FORBIDDEN',
        'You do not have permission to access this resource',
      );
    }
    return true;
  }
}
