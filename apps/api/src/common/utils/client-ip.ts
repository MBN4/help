import type { Request } from 'express';

/**
 * Best-effort client IP for Phase 8 moderation-scoring signals (burst/flood detection) — never used for
 * anything security-critical (rate limiting already goes through `@nestjs/throttler`'s own tracker). Reads
 * `request.ip`, which respects Express's `trust proxy` setting (enabled in `main.ts` in production) so this
 * reflects `X-Forwarded-For` behind a real reverse proxy rather than the proxy's own address.
 */
export function getClientIp(request: Request): string | null {
  return request.ip ?? null;
}
