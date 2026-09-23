import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.schema';

export interface RevalidateTarget {
  slug?: string;
  city?: string;
  category?: string;
}

/**
 * Calls the web app's `POST /api/revalidate` (see apps/web/app/api/revalidate/route.ts) after a write that
 * affects an ISR page, so the business profile / city hub / city+category pages refresh without waiting for
 * their revalidate window. Best-effort: a failure here never fails the write that triggered it.
 */
@Injectable()
export class RevalidateService {
  private readonly logger = new Logger(RevalidateService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async revalidate(target: RevalidateTarget): Promise<void> {
    const secret = this.config.get('REVALIDATE_SECRET', { infer: true });
    if (!secret) {
      return;
    }
    const url = this.config.get('WEB_REVALIDATE_URL', { infer: true });

    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-revalidate-secret': secret,
        },
        body: JSON.stringify(target),
      });
    } catch (error) {
      this.logger.warn(`Failed to trigger ISR revalidation: ${String(error)}`);
    }
  }
}
