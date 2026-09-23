import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AppException } from '../exceptions/app.exception';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const REQUIRED_HEADER = 'x-requested-with';
const REQUIRED_VALUE = 'buisnez-web';

/**
 * Now that auth is cookie-based, browsers attach cookies automatically to cross-site requests too.
 * `SameSite=Lax` blocks most of that, but isn't a complete defense on its own — every mutating request
 * additionally requires this custom header, which a cross-site form/script/image tag cannot set. The web
 * client attaches it to every request (see apps/web/src/lib/api/client.ts); the future mobile app uses
 * Bearer tokens instead and never hits cookie-authenticated routes, so it's unaffected.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) {
      return true;
    }
    if (request.headers[REQUIRED_HEADER] !== REQUIRED_VALUE) {
      throw new AppException(
        403,
        'CSRF_CHECK_FAILED',
        'Missing or invalid X-Requested-With header',
      );
    }
    return true;
  }
}
