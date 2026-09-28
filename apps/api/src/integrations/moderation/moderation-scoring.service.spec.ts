import {
  ModerationScoringService,
  ScoringContext,
} from './moderation-scoring.service';

function buildContext(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    targetType: 'REVIEW',
    targetId: 'target-1',
    userId: 'user-1',
    businessId: 'business-1',
    ipAddress: '10.0.0.1',
    text: 'A perfectly ordinary review of this place, would recommend to friends.',
    rating: 4,
    ...overrides,
  };
}

describe('ModerationScoringService', () => {
  let prisma: {
    $queryRaw: jest.Mock;
    review: { count: jest.Mock };
    photo: { count: jest.Mock };
    user: { findUnique: jest.Mock };
  };
  let service: ModerationScoringService;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ hit: false }]),
      review: { count: jest.fn().mockResolvedValue(0) },
      photo: { count: jest.fn().mockResolvedValue(0) },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        }),
      },
    };
    service = new ModerationScoringService(prisma as never);
  });

  it('auto-approves genuine content with no triggered rule', async () => {
    const result = await service.score(buildContext());
    expect(result.decision).toBe('APPROVE');
    expect(result.reasons).toEqual([]);
  });

  it('holds content with duplicate/near-duplicate text', async () => {
    prisma.$queryRaw.mockResolvedValue([{ hit: true }]);
    const result = await service.score(buildContext());
    expect(result.decision).toBe('HOLD');
    expect(result.reasons).toContain('DUPLICATE_TEXT');
  });

  it('does not run the duplicate-text check on short/empty text', async () => {
    const result = await service.score(buildContext({ text: 'ok' }));
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(result.reasons).not.toContain('DUPLICATE_TEXT');
  });

  it('holds content containing a link', async () => {
    const result = await service.score(
      buildContext({ text: 'Great place! Check out http://spam.example' }),
    );
    expect(result.decision).toBe('HOLD');
    expect(result.reasons).toContain('SPAM_LINKS');
  });

  it('holds content containing a known spam phrase', async () => {
    const result = await service.score(
      buildContext({ text: 'DM me on whatsapp me on +923001234567 for deals' }),
    );
    expect(result.decision).toBe('HOLD');
    expect(result.reasons).toContain('SPAM_LINKS');
  });

  it('holds an extreme rating when the business already has a wave of extreme ratings', async () => {
    prisma.review.count.mockResolvedValue(5); // 5 others + this one = 6
    const result = await service.score(buildContext({ rating: 5 }));
    expect(result.decision).toBe('HOLD');
    expect(result.reasons).toContain('REVIEW_BOMBING');
  });

  it('does not flag a single extreme rating on an otherwise-quiet business', async () => {
    prisma.review.count.mockResolvedValue(4); // below the review-bombing threshold
    const result = await service.score(buildContext({ rating: 5 }));
    expect(result.reasons).not.toContain('REVIEW_BOMBING');
  });

  it('does not flag review-bombing for a moderate rating', async () => {
    prisma.review.count.mockResolvedValue(10);
    const result = await service.score(buildContext({ rating: 3 }));
    expect(result.reasons).not.toContain('REVIEW_BOMBING');
  });

  it('holds content from an IP with a submission burst', async () => {
    prisma.review.count.mockResolvedValue(4);
    const result = await service.score(buildContext());
    expect(result.decision).toBe('HOLD');
    expect(result.reasons).toContain('IP_BURST');
  });

  it('skips the IP-burst check when no IP is available', async () => {
    prisma.review.count.mockResolvedValue(10);
    const result = await service.score(buildContext({ ipAddress: null }));
    expect(result.reasons).not.toContain('IP_BURST');
  });

  it('holds content from an account with a submission burst', async () => {
    // First two count() calls are the IP-burst check (review, photo); next two are account-burst.
    prisma.review.count
      .mockResolvedValueOnce(0) // ip review count
      .mockResolvedValueOnce(2); // account review count
    const result = await service.score(buildContext());
    expect(result.decision).toBe('HOLD');
    expect(result.reasons).toContain('ACCOUNT_BURST');
  });

  it('holds content from a low-trust account with prior held/removed content', async () => {
    prisma.review.count
      .mockResolvedValueOnce(0) // ip burst
      .mockResolvedValueOnce(0) // account burst
      .mockResolvedValueOnce(2); // low-trust prior-held reviews
    const result = await service.score(buildContext());
    expect(result.decision).toBe('HOLD');
    expect(result.reasons).toContain('LOW_TRUST_ACCOUNT');
  });

  it('flags a brand-new account posting several times right after signup', async () => {
    prisma.user.findUnique.mockResolvedValue({ createdAt: new Date() });
    prisma.review.count
      .mockResolvedValueOnce(0) // ip burst
      .mockResolvedValueOnce(0) // account burst
      .mockResolvedValueOnce(0) // low-trust
      .mockResolvedValueOnce(3); // total review count for new-account-flood
    const result = await service.score(buildContext());
    expect(result.reasons).toContain('NEW_ACCOUNT_FLOOD');
  });

  it('does not flag new-account-flood for an older account', async () => {
    const result = await service.score(buildContext());
    expect(result.reasons).not.toContain('NEW_ACCOUNT_FLOOD');
  });

  it('sums weights from multiple triggered rules', async () => {
    prisma.$queryRaw.mockResolvedValue([{ hit: true }]);
    const result = await service.score(
      buildContext({ text: 'Duplicate text with a link http://spam.example' }),
    );
    expect(result.reasons).toEqual(
      expect.arrayContaining(['DUPLICATE_TEXT', 'SPAM_LINKS']),
    );
    expect(result.score).toBeGreaterThanOrEqual(110);
  });
});
