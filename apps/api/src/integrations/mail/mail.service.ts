import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.schema';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  sendEmailVerification(to: string, token: string): void {
    const link = `${this.config.get('WEB_ORIGIN', { infer: true })}/verify-email?token=${token}`;
    this.log(to, 'Verify your Buisnez account', link);
  }

  sendPasswordReset(to: string, token: string): void {
    const link = `${this.config.get('WEB_ORIGIN', { infer: true })}/reset-password?token=${token}`;
    this.log(to, 'Reset your Buisnez password', link);
  }

  /** Phase 7: claim decision notice — same log-stub pattern, no real SMTP provider configured. */
  notifyClaimDecision(
    to: string,
    businessName: string,
    decision: 'approved' | 'rejected',
  ): void {
    const link = `${this.config.get('WEB_ORIGIN', { infer: true })}/account/businesses`;
    this.log(to, `Your claim for "${businessName}" was ${decision}`, link);
  }

  private log(to: string, subject: string, link: string): void {
    // No SMTP provider is configured in Phase 1: log the link so local/dev flows are testable end-to-end.
    this.logger.log(`[mail stub] to=${to} subject="${subject}" link=${link}`);
  }
}
