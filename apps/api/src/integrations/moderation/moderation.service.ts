import { Injectable, Logger } from '@nestjs/common';
import {
  ModerationScoringService,
  ScoringContext,
  ScoringReason,
} from './moderation-scoring.service';
import {
  ModerationLogService,
  MODERATION_ACTIONS,
} from './moderation-log.service';

export type ModerationTargetType = 'REVIEW' | 'PHOTO';

export interface ModerationResult {
  status: 'APPROVED' | 'PENDING';
  score: number | null;
  reasons: ScoringReason[];
}

/**
 * Phase 8: real automated flagging/scoring pass, replacing the Phase 5/7 no-op seam that always returned
 * `APPROVED`. Every review/photo write still calls `enqueue()`; it now runs `ModerationScoringService`'s
 * rule-based scoring and returns `PENDING` (hold for the moderation queue) whenever the score crosses
 * `HOLD_THRESHOLD`. There is deliberately no path here that returns anything other than APPROVED/PENDING —
 * automated actions never remove content outright (see docs/11-reviews-trust-safety.md). The caller
 * (`ReviewsService`/`PhotosService`) is responsible for applying the returned status to the row and logging
 * the ModerationLog entry, since only the caller knows the row's final id/businessId at enqueue time.
 */
@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    private readonly scoring: ModerationScoringService,
    private readonly moderationLog: ModerationLogService,
  ) {}

  async enqueue(context: ScoringContext): Promise<ModerationResult> {
    const result = await this.scoring.score(context);

    this.logger.debug(
      `[moderation] ${context.targetType} ${context.targetId} score=${result.score} decision=${result.decision} reasons=${result.reasons.join(',') || 'none'}`,
    );

    await this.moderationLog.record({
      actorId: null,
      action:
        result.decision === 'HOLD'
          ? context.targetType === 'REVIEW'
            ? MODERATION_ACTIONS.REVIEW_AUTO_HELD
            : MODERATION_ACTIONS.PHOTO_AUTO_HELD
          : context.targetType === 'REVIEW'
            ? MODERATION_ACTIONS.REVIEW_AUTO_APPROVED
            : MODERATION_ACTIONS.PHOTO_AUTO_APPROVED,
      targetType: context.targetType,
      targetId: context.targetId,
      reason: result.reasons.length ? result.reasons.join(', ') : null,
      metadata: { score: result.score, reasons: result.reasons },
    });

    return {
      status: result.decision === 'HOLD' ? 'PENDING' : 'APPROVED',
      score: result.score,
      reasons: result.reasons,
    };
  }

  /** Self-review is a hard block, not a scoring rule (see docs/11-reviews-trust-safety.md) — no Review row
   * is ever created, so there's nothing to hold/appeal. Logged against the user for audit visibility. */
  async logSelfReviewBlocked(
    userId: string,
    businessId: string,
  ): Promise<void> {
    await this.moderationLog.record({
      actorId: null,
      action: MODERATION_ACTIONS.SELF_REVIEW_BLOCKED,
      targetType: 'USER',
      targetId: userId,
      reason: 'Attempted to review own business',
      metadata: { businessId },
    });
  }
}

export type { ScoringContext };
