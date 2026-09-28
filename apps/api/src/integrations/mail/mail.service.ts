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

  /**
   * Phase 8: automated-hold notice — fired the moment the scoring pipeline holds a review/photo as PENDING.
   * `reasons` are the triggered rule names (see ModerationScoringService), shown to the author so they know
   * why, with a link to the account page they can appeal from. Never sent for the self-review hard block
   * (there's no created row to notify about).
   */
  notifyContentHeld(
    to: string,
    targetType: 'REVIEW' | 'PHOTO',
    reasons: string[],
  ): void {
    const link = `${this.config.get('WEB_ORIGIN', { infer: true })}/account/${targetType === 'REVIEW' ? 'reviews' : 'photos'}`;
    this.log(
      to,
      `Your ${targetType.toLowerCase()} is awaiting review`,
      `${link} (reasons: ${reasons.join(', ') || 'flagged for review'})`,
    );
  }

  /** Phase 8: admin/moderator removal notice — always carries the required removal reason. */
  notifyContentRemoved(
    to: string,
    targetType: 'REVIEW' | 'PHOTO',
    reason: string,
  ): void {
    const link = `${this.config.get('WEB_ORIGIN', { infer: true })}/account/${targetType === 'REVIEW' ? 'reviews' : 'photos'}`;
    this.log(
      to,
      `Your ${targetType.toLowerCase()} was removed`,
      `${link} (reason: ${reason})`,
    );
  }

  private log(to: string, subject: string, link: string): void {
    // No SMTP provider is configured in Phase 1: log the link so local/dev flows are testable end-to-end.
    this.logger.log(`[mail stub] to=${to} subject="${subject}" link=${link}`);
  }
}
