'use client';

import { useTranslations } from 'next-intl';
import { BadgeCheck, ThumbsUp } from 'lucide-react';
import type { BusinessReview } from '@buisnez/shared';
import { Link } from '@/i18n/navigation';
import { RatingStars } from '@/components/business/rating-stars';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ReportButton } from '@/components/report/report-button';

export function ReviewCard({
  review,
  isHelpfulByMe,
  onToggleHelpful,
}: {
  review: BusinessReview;
  isHelpfulByMe?: boolean;
  onToggleHelpful?: () => void;
}): React.ReactElement {
  const t = useTranslations('business');
  const reviewT = useTranslations('review');

  return (
    <article className="space-y-2 border-b border-border py-5 last:border-0">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 font-display text-lg font-bold text-brand-700"
        >
          {review.userName.trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/reviewers/${review.userId}`}
              className="font-semibold text-ink hover:underline"
            >
              {review.userName}
            </Link>
            {review.isVerifiedReviewer && (
              <Badge variant="outline" className="gap-1">
                <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                {reviewT('verifiedReviewer')}
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <RatingStars rating={review.rating} />
        <time
          dateTime={review.createdAt}
          className="text-sm text-muted-foreground"
        >
          {new Date(review.createdAt).toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </time>
      </div>
      {review.title && <h3 className="font-semibold">{review.title}</h3>}
      {review.body && <p className="text-foreground/90">{review.body}</p>}
      {review.ownerReply && (
        <div className="ms-4 rounded-md bg-muted p-3 text-sm">
          <p className="mb-1 font-medium">{t('ownerReply')}</p>
          <p className="text-muted-foreground">{review.ownerReply}</p>
        </div>
      )}
      <div className="flex items-center gap-1 pt-1">
        <Button
          type="button"
          variant={isHelpfulByMe ? 'accent' : 'outline'}
          size="sm"
          onClick={onToggleHelpful}
          disabled={!onToggleHelpful}
        >
          <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
          {reviewT('helpfulCount', { count: review.helpfulCount })}
        </Button>
        <ReportButton targetType="REVIEW" targetId={review.id} />
      </div>
    </article>
  );
}
