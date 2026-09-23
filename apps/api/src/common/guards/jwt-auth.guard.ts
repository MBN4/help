import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Env } from '../../config/env.schema';
import { AppException } from '../exceptions/app.exception';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { RequestUser } from '../decorators/current-user.decorator';
import { AccessTokenPayload } from '../../modules/auth/token.types';
import { ACCESS_COOKIE_NAME } from '../constants/auth-cookies';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();
    const token = this.extractToken(request);
    if (!token) {
      throw new AppException(401, 'UNAUTHORIZED', 'Missing access token');
    }

    try {
      const payload = this.jwtService.verify<AccessTokenPayload>(token, {
        secret: this.config.get('JWT_SECRET', { infer: true }),
      });
      request.user = { id: payload.sub, role: payload.role };
      return true;
    } catch {
      throw new AppException(
        401,
        'UNAUTHORIZED',
        'Invalid or expired access token',
      );
    }
  }

  /**
   * Web: the `access_token` httpOnly cookie (never JS-readable). Mobile (future): `Authorization: Bearer`.
   * Checked in that order so a stray `Authorization` header never shadows the cookie-authenticated web flow.
   */
  private extractToken(request: Request): string | undefined {
    const cookies = request.cookies as
      Record<string, string | undefined> | undefined;
    const cookieToken = cookies?.[ACCESS_COOKIE_NAME];
    if (cookieToken) {
      return cookieToken;
    }

    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return undefined;
    }
    return header.slice('Bearer '.length);
  }
}
