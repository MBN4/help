'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { getMyReviews } from '@/lib/api';
import { Link } from '@/i18n/navigation';
import { RatingStars } from '@/components/business/rating-stars';
import { Skeleton } from '@/components/ui/skeleton';

export default function AccountReviewsPage(): React.ReactElement {
  const t = useTranslations('account');
  const { data, isLoading } = useQuery({
    queryKey: ['my-reviews'],
    queryFn: async () => (await getMyReviews(1, 50)).data,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('reviewsTitle')}</h1>
      {isLoading && <Skeleton className="h-32 w-full" />}
      {!isLoading && data?.length === 0 && (
        <p className="text-muted-foreground">{t('reviewsEmpty')}</p>
      )}
      <div className="space-y-4">
        {data?.map((review) => (
          <article
            key={review.id}
            className="space-y-1.5 border-b border-border pb-4"
          >
            <Link
              href={`/business/${review.business.slug}`}
              className="font-semibold hover:underline"
            >
              {review.business.name}
            </Link>
            <div className="flex items-center gap-2">
              <RatingStars rating={review.rating} />
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
            {review.title && <p className="font-medium">{review.title}</p>}
            {review.body && (
              <p className="text-sm text-foreground/90">{review.body}</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
