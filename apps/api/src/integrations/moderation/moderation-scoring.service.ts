import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Rule-based spam/abuse scoring for the Phase 8 moderation seam (see docs/11-reviews-trust-safety.md for the
 * authoritative, human-readable writeup of these rules and their tuned thresholds — keep both in sync).
 *
 * Every rule below only ever *adds* weight toward a HOLD decision — there is no rule that scores toward
 * auto-removal. Genuine content with no triggered rule always auto-approves; anything ambiguous defaults to
 * PENDING for human review (see `ModerationService.enqueue`). Self-review is handled as a hard block
 * upstream of this service (in `ReviewsService.createOrUpdate`), not as a scoring rule, since it must never
 * be reversible-by-appeal the way a held review is.
 */

export const HOLD_THRESHOLD = 40;

export const SCORING_WEIGHTS = {
  DUPLICATE_TEXT: 50,
  SPAM_LINKS: 60,
  REVIEW_BOMBING: 50,
  IP_BURST: 40,
  ACCOUNT_BURST: 40,
  LOW_TRUST_ACCOUNT: 40,
  NEW_ACCOUNT_FLOOD: 30,
} as const;

export type ScoringReason = keyof typeof SCORING_WEIGHTS;

const BURST_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const BURST_ACCOUNT_MIN_COUNT = 3;
const BURST_IP_MIN_COUNT = 5;
const REVIEW_BOMBING_WINDOW_MS = 60 * 60 * 1000; // 60 minutes
const REVIEW_BOMBING_MIN_COUNT = 6;
const NEW_ACCOUNT_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const NEW_ACCOUNT_MIN_SUBMISSIONS = 3;
const LOW_TRUST_PRIOR_HELD_MIN_COUNT = 2;
const DUPLICATE_TEXT_SIMILARITY = 0.6;
const DUPLICATE_TEXT_MIN_LENGTH = 20;

// Deliberately conservative/obvious phrases and link patterns — anything subtler is exactly the kind of
// "ambiguous" case that should fall through to PENDING for a human, not get auto-flagged as spam.
const SPAM_LINK_PATTERN = /https?:\/\/|www\.[a-z0-9-]+\.[a-z]{2,}/i;
const SPAM_PHRASE_PATTERNS: RegExp[] = [
  /\bwa\.me\//i,
  /\bt\.me\//i,
  /\bclick here\b/i,
  /\bfollow (us|me) (on|at)\b/i,
  /\bdm (me|us) (on|at)\b/i,
  /\bwhatsapp (me|us) (on|at)\s*\+?\d/i,
  /\bfree followers\b/i,
  /\bforex\b.*\bsignal/i,
  /\bcrypto\b.*\bsignal/i,
  /\bdiscount code\b/i,
  /\bwork from home\b.*\bearn\b/i,
];

export interface ScoringContext {
  targetType: 'REVIEW' | 'PHOTO';
  targetId: string;
  userId: string;
  businessId: string | null;
  ipAddress: string | null;
  text: string | null;
  rating: number | null;
}

export interface ScoringResult {
  decision: 'APPROVE' | 'HOLD';
  score: number;
  reasons: ScoringReason[];
}

@Injectable()
export class ModerationScoringService {
  constructor(private readonly prisma: PrismaService) {}

  async score(context: ScoringContext): Promise<ScoringResult> {
    const reasons = new Set<ScoringReason>();

    const [
      duplicateText,
      spamLinks,
      reviewBombing,
      ipBurst,
      accountBurst,
      lowTrustAccount,
      newAccountFlood,
    ] = await Promise.all([
      this.checkDuplicateText(context),
      this.checkSpamLinks(context),
      this.checkReviewBombing(context),
      this.checkIpBurst(context),
      this.checkAccountBurst(context),
      this.checkLowTrustAccount(context),
      this.checkNewAccountFlood(context),
    ]);

    if (duplicateText) reasons.add('DUPLICATE_TEXT');
    if (spamLinks) reasons.add('SPAM_LINKS');
    if (reviewBombing) reasons.add('REVIEW_BOMBING');
    if (ipBurst) reasons.add('IP_BURST');
    if (accountBurst) reasons.add('ACCOUNT_BURST');
    if (lowTrustAccount) reasons.add('LOW_TRUST_ACCOUNT');
    if (newAccountFlood) reasons.add('NEW_ACCOUNT_FLOOD');

    const score = [...reasons].reduce(
      (sum, reason) => sum + SCORING_WEIGHTS[reason],
      0,
    );

    return {
      decision: score >= HOLD_THRESHOLD ? 'HOLD' : 'APPROVE',
      score,
      reasons: [...reasons],
    };
  }

  /** Near-duplicate text: same user reposting a template across businesses, or an exact copy of someone
   * else's review body posted recently anywhere on the platform (a common scripted-spam pattern). */
  private async checkDuplicateText(ctx: ScoringContext): Promise<boolean> {
    const text = ctx.text?.trim();
    if (!text || text.length < DUPLICATE_TEXT_MIN_LENGTH) return false;

    const rows = await this.prisma.$queryRaw<{ hit: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM "Review"
        WHERE "userId" = ${ctx.userId}
          AND "id" != ${ctx.targetId}
          AND "body" IS NOT NULL
          AND similarity("body", ${text}) > ${DUPLICATE_TEXT_SIMILARITY}
      ) OR EXISTS (
        SELECT 1 FROM "Review"
        WHERE "id" != ${ctx.targetId}
          AND "createdAt" > now() - interval '30 days'
          AND "body" IS NOT NULL
          AND similarity("body", ${text}) > ${DUPLICATE_TEXT_SIMILARITY}
      ) AS hit
    `;
    return rows[0]?.hit ?? false;
  }

  /** Reviews shouldn't carry outbound links/contact-solicitation phrases at all. */
  private checkSpamLinks(ctx: ScoringContext): boolean {
    const text = ctx.text;
    if (!text) return false;
    if (SPAM_LINK_PATTERN.test(text)) return true;
    return SPAM_PHRASE_PATTERNS.some((pattern) => pattern.test(text));
  }

  /** A sudden wave of extreme (1 or 5 star) ratings on one business, with this review also extreme —
   * targets the "review-bombing" scenario rather than organic rating variance. */
  private async checkReviewBombing(ctx: ScoringContext): Promise<boolean> {
    if (ctx.targetType !== 'REVIEW' || !ctx.businessId || ctx.rating == null) {
      return false;
    }
    if (ctx.rating !== 1 && ctx.rating !== 5) return false;

    const count = await this.prisma.review.count({
      where: {
        businessId: ctx.businessId,
        id: { not: ctx.targetId },
        rating: { in: [1, 5] },
        createdAt: { gt: new Date(Date.now() - REVIEW_BOMBING_WINDOW_MS) },
      },
    });
    return count >= REVIEW_BOMBING_MIN_COUNT - 1;
  }

  /** Many submissions from the same IP in a short window — catches multi-account abuse a per-user check
   * alone would miss. */
  private async checkIpBurst(ctx: ScoringContext): Promise<boolean> {
    if (!ctx.ipAddress) return false;
    const since = new Date(Date.now() - BURST_WINDOW_MS);
    const [reviewCount, photoCount] = await Promise.all([
      this.prisma.review.count({
        where: {
          ipAddress: ctx.ipAddress,
          id: ctx.targetType === 'REVIEW' ? { not: ctx.targetId } : undefined,
          createdAt: { gt: since },
        },
      }),
      this.prisma.photo.count({
        where: {
          ipAddress: ctx.ipAddress,
          id: ctx.targetType === 'PHOTO' ? { not: ctx.targetId } : undefined,
          createdAt: { gt: since },
        },
      }),
    ]);
    return reviewCount + photoCount >= BURST_IP_MIN_COUNT - 1;
  }

  /** Many submissions from the same account in a short window. */
  private async checkAccountBurst(ctx: ScoringContext): Promise<boolean> {
    const since = new Date(Date.now() - BURST_WINDOW_MS);
    const [reviewCount, photoCount] = await Promise.all([
      this.prisma.review.count({
        where: {
          userId: ctx.userId,
          id: ctx.targetType === 'REVIEW' ? { not: ctx.targetId } : undefined,
          createdAt: { gt: since },
        },
      }),
      this.prisma.photo.count({
        where: {
          userId: ctx.userId,
          id: ctx.targetType === 'PHOTO' ? { not: ctx.targetId } : undefined,
          createdAt: { gt: since },
        },
      }),
    ]);
    return reviewCount + photoCount >= BURST_ACCOUNT_MIN_COUNT - 1;
  }

  /** An account with a track record of held/removed content defaults future content to PENDING too. */
  private async checkLowTrustAccount(ctx: ScoringContext): Promise<boolean> {
    const [heldReviews, heldPhotos] = await Promise.all([
      this.prisma.review.count({
        where: {
          userId: ctx.userId,
          id: ctx.targetType === 'REVIEW' ? { not: ctx.targetId } : undefined,
          status: { in: ['PENDING', 'REMOVED'] },
        },
      }),
      this.prisma.photo.count({
        where: {
          userId: ctx.userId,
          id: ctx.targetType === 'PHOTO' ? { not: ctx.targetId } : undefined,
          status: { in: ['PENDING', 'REMOVED'] },
        },
      }),
    ]);
    return heldReviews + heldPhotos >= LOW_TRUST_PRIOR_HELD_MIN_COUNT;
  }

  /** A brand-new account posting several times right after signup. */
  private async checkNewAccountFlood(ctx: ScoringContext): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { createdAt: true },
    });
    if (!user) return false;
    const isNew = Date.now() - user.createdAt.getTime() < NEW_ACCOUNT_AGE_MS;
    if (!isNew) return false;

    const [reviewCount, photoCount] = await Promise.all([
      this.prisma.review.count({ where: { userId: ctx.userId } }),
      this.prisma.photo.count({ where: { userId: ctx.userId } }),
    ]);
    return reviewCount + photoCount >= NEW_ACCOUNT_MIN_SUBMISSIONS;
  }
}
