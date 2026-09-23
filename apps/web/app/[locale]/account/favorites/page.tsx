'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { getMyFavorites } from '@/lib/api';
import { BusinessCard } from '@/components/business/business-card';
import { Skeleton } from '@/components/ui/skeleton';

export default function AccountFavoritesPage(): React.ReactElement {
  const t = useTranslations('account');
  const { data, isLoading } = useQuery({
    queryKey: ['my-favorites'],
    queryFn: async () => (await getMyFavorites(1, 50)).data,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('favoritesTitle')}</h1>
      {isLoading && <Skeleton className="h-32 w-full" />}
      {!isLoading && data?.length === 0 && (
        <p className="text-muted-foreground">{t('favoritesEmpty')}</p>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {data?.map((business) => (
          <BusinessCard key={business.id} business={business} />
        ))}
      </div>
    </div>
  );
}
