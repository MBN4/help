'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { BusinessReview } from '@buisnez/shared';
import { ApiError, deleteReviewReply, replyToReview } from '@/lib/api';
import { RatingStars } from '@/components/business/rating-stars';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

function ReviewReplyRow({
  businessId,
  review,
  onChange,
}: {
  businessId: string;
  review: BusinessReview;
  onChange: (review: BusinessReview) => void;
}): React.ReactElement {
  const t = useTranslations('businessOwner');
  const [reply, setReply] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleReply(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!reply.trim()) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const { data } = await replyToReview(businessId, review.id, {
        reply: reply.trim(),
      });
      onChange(data);
      setReply('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errorGeneric'));
    } finally {
      setPending(false);
    }
  }

  async function handleDeleteReply(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const { data } = await deleteReviewReply(businessId, review.id);
      onChange(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errorGeneric'));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">{review.userName}</span>
            <RatingStars rating={review.rating} />
          </div>
          <time className="text-xs text-muted-foreground">
            {new Date(review.createdAt).toLocaleDateString('en-GB', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </time>
        </div>
        {review.title && <h3 className="font-semibold">{review.title}</h3>}
        {review.body && <p className="text-sm">{review.body}</p>}

        {review.ownerReply ? (
          <div className="ms-4 space-y-2 rounded-md bg-muted p-3 text-sm">
            <p className="font-medium">{t('reviews.yourReply')}</p>
            <p className="text-muted-foreground">{review.ownerReply}</p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={handleDeleteReply}
            >
              {t('reviews.deleteReply')}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleReply} className="space-y-2">
            <Textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder={t('reviews.replyPlaceholder')}
              maxLength={2000}
            />
            <Button type="submit" size="sm" disabled={pending || !reply.trim()}>
              {t('reviews.postReply')}
            </Button>
          </form>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

export function ReviewsEditor({
  businessId,
  reviews,
  onChange,
}: {
  businessId: string;
  reviews: BusinessReview[];
  onChange: (reviews: BusinessReview[]) => void;
}): React.ReactElement {
  const t = useTranslations('businessOwner');

  function handleReviewChange(updated: BusinessReview): void {
    onChange(reviews.map((r) => (r.id === updated.id ? updated : r)));
  }

  if (reviews.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('reviews.none')}</p>;
  }

  return (
    <div className="max-w-2xl space-y-3">
      {reviews.map((review) => (
        <ReviewReplyRow
          key={review.id}
          businessId={businessId}
          review={review}
          onChange={handleReviewChange}
        />
      ))}
    </div>
  );
}
