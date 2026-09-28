import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PostHog } from 'posthog-node';

/**
 * Thin wrapper around `posthog-node` — no-op whenever `POSTHOG_KEY` is unset, same "stub until
 * credentialed" pattern as `MailService`/`OAuthService`. Never throws, never blocks the caller.
 */
@Injectable()
export class AnalyticsService implements OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly client: PostHog | null;

  constructor() {
    const key = process.env.POSTHOG_KEY;
    this.client = key ? new PostHog(key) : null;
  }

  capture(
    event: string,
    distinctId: string,
    properties?: Record<string, unknown>,
  ): void {
    if (!this.client) {
      return;
    }
    try {
      this.client.capture({ distinctId, event, properties });
    } catch (error) {
      this.logger.warn(
        `Failed to capture analytics event "${event}": ${String(error)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.shutdown();
    }
  }
}
