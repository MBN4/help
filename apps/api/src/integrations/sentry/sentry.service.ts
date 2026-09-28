import { Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';

/**
 * Thin wrapper around `@sentry/node` — no-op whenever `SENTRY_DSN` is unset (same "stub until
 * credentialed" pattern as `OAuthService.isConfigured`/`MailService`: never throws, never blocks
 * startup or the request path). `Sentry.init()` itself is called once, early, in `main.ts`.
 */
@Injectable()
export class SentryService {
  private readonly logger = new Logger(SentryService.name);
  private readonly enabled = Boolean(process.env.SENTRY_DSN);

  isEnabled(): boolean {
    return this.enabled;
  }

  captureException(error: unknown): void {
    if (!this.enabled) {
      return;
    }
    try {
      Sentry.captureException(error);
    } catch (captureError) {
      this.logger.warn(
        `Failed to report exception to Sentry: ${String(captureError)}`,
      );
    }
  }
}
