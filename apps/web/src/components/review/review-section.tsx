'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { BusinessProfile, BusinessReview } from '@buisnez/shared';
import { getMyReview } from '@/lib/api';
import { useSession } from '@/lib/hooks/use-session';
import { Link, usePathname } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ReviewForm } from './review-form';

export function ReviewSection({
  business,
}: {
  business: BusinessProfile;
}): React.ReactElement {
  const t = useTranslations('review');
  const pathname = usePathname();
  const { user, isLoading: sessionLoading, isAuthenticated } = useSession();

  const myReviewQuery = useQuery({
    queryKey: ['my-review', business.id, user?.id],
    queryFn: async () => (await getMyReview(business.id)).data,
    enabled: isAuthenticated,
  });

  const [saved, setSaved] = React.useState<BusinessReview | null>(null);

  if (sessionLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (!isAuthenticated) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-sm">
        <p className="mb-2 text-muted-foreground">{t('loginRequired')}</p>
        <Button asChild size="sm">
          <Link href={`/login?returnTo=${encodeURIComponent(pathname)}`}>
            {t('writeReview')}
          </Link>
        </Button>
      </div>
    );
  }

  if (user && !user.emailVerifiedAt) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        {t('verifyRequired')}
      </div>
    );
  }

  if (saved) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-success">{t('submitSuccess')}</p>
        <ReviewForm
          business={business}
          existingReview={saved}
          onSaved={setSaved}
        />
      </div>
    );
  }

  if (myReviewQuery.isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <ReviewForm
      business={business}
      existingReview={myReviewQuery.data ?? undefined}
      onSaved={setSaved}
    />
  );
}
