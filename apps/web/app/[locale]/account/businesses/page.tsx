'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { getMyOwnedBusinesses } from '@/lib/api';
import { Link } from '@/i18n/navigation';
import { RatingStars } from '@/components/business/rating-stars';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS_VARIANT: Record<
  string,
  'default' | 'secondary' | 'success' | 'warning'
> = {
  PENDING: 'warning',
  PUBLISHED: 'success',
  REJECTED: 'secondary',
  SUSPENDED: 'secondary',
};

export default function AccountBusinessesPage(): React.ReactElement {
  const t = useTranslations('businessOwner');

  const query = useQuery({
    queryKey: ['my-owned-businesses'],
    queryFn: async () => (await getMyOwnedBusinesses()).data,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('dashboardTitle')}</h1>

      {query.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {query.data && query.data.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="mb-3 text-muted-foreground">{t('noOwnedBusinesses')}</p>
          <Button asChild size="sm">
            <Link href="/search">{t('browseToClaim')}</Link>
          </Button>
        </div>
      )}

      {query.data && query.data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {query.data.map((business) => (
            <Link key={business.id} href={`/account/businesses/${business.id}`}>
              <Card className="h-full transition-colors hover:border-primary">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold">{business.name}</h2>
                    <Badge
                      variant={STATUS_VARIANT[business.status] ?? 'default'}
                    >
                      {t(`status.${business.status}`)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <RatingStars rating={business.averageRating} />
                    <span className="text-sm text-muted-foreground">
                      {t('reviewCount', { count: business.reviewCount })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
