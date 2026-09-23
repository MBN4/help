'use client';

import { useTranslations } from 'next-intl';
import type { BusinessReview } from '@buisnez/shared';
import { RatingStars } from '@/components/business/rating-stars';
import { Button } from '@/components/ui/button';
import { ThumbsUp } from 'lucide-react';
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
    <article className="space-y-2 border-b border-border py-4 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{review.userName}</span>
          <RatingStars rating={review.rating} />
        </div>
        <time
          dateTime={review.createdAt}
          className="text-xs text-muted-foreground"
        >
          {new Date(review.createdAt).toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </time>
      </div>
      {review.title && <h3 className="font-semibold">{review.title}</h3>}
      {review.body && (
        <p className="text-sm text-foreground/90">{review.body}</p>
      )}
      {review.ownerReply && (
        <div className="ms-4 rounded-md bg-muted p-3 text-sm">
          <p className="mb-1 font-medium">{t('ownerReply')}</p>
          <p className="text-muted-foreground">{review.ownerReply}</p>
        </div>
      )}
      <div className="flex items-center gap-1 pt-1">
        <Button
          type="button"
          variant={isHelpfulByMe ? 'accent' : 'ghost'}
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
