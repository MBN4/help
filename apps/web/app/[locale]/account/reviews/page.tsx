'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { getMyReviews } from '@/lib/api';
import { Link } from '@/i18n/navigation';
import { RatingBadge } from '@/components/business/rating-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ModerationStatusBanner } from '@/components/moderation/moderation-status-banner';

export default function AccountReviewsPage(): React.ReactElement {
  const t = useTranslations('account');
  const { data, isLoading } = useQuery({
    queryKey: ['my-reviews'],
    queryFn: async () => (await getMyReviews(1, 50)).data,
  });

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">{t('reviewsTitle')}</h1>
      {isLoading && <Skeleton className="h-32 w-full" />}
      {!isLoading && data?.length === 0 && (
        <p className="text-muted-foreground">{t('reviewsEmpty')}</p>
      )}
      <div className="space-y-4">
        {data?.map((review) => (
          <article
            key={review.id}
            className="space-y-2 rounded border border-border bg-white p-4"
          >
            <Link
              href={`/business/${review.business.slug}`}
              className="font-display text-base font-bold hover:underline"
            >
              {review.business.name}
            </Link>
            <div className="flex items-center gap-2">
              <RatingBadge rating={review.rating} />
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
            {review.title && <p className="font-semibold">{review.title}</p>}
            {review.body && (
              <p className="text-sm leading-relaxed text-ink">{review.body}</p>
            )}
            <ModerationStatusBanner
              targetType="REVIEW"
              targetId={review.id}
              status={review.status}
              moderationReason={review.moderationReason}
            />
          </article>
        ))}
      </div>
    </div>
  );
}
