import { Injectable, Logger } from '@nestjs/common';

export type ModerationTargetType = 'REVIEW' | 'PHOTO';

export interface ModerationResult {
  status: 'APPROVED';
  score: null;
}

/**
 * Phase 5 publishes reviews/photos immediately — there is no admin queue yet to hold a PENDING row (see
 * docs/11-reviews-trust-safety.md). This seam still fires on every write so Phase 8's real automated
 * flagging/scoring pass has a call site to plug into without touching ReviewsService/PhotosService again;
 * today it's a no-op that always approves.
 */
@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  async enqueue(
    targetType: ModerationTargetType,
    targetId: string,
  ): Promise<ModerationResult> {
    this.logger.debug(
      `[moderation stub] ${targetType} ${targetId} auto-approved (no scoring pipeline yet — see phase-8 seam)`,
    );
    return { status: 'APPROVED', score: null };
  }
}
