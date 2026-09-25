'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { getAdminUser } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminUserDetailPage(): React.ReactElement {
  const params = useParams<{ userId: string }>();
  const t = useTranslations('admin');
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', params.userId],
    queryFn: () => getAdminUser(params.userId),
  });

  if (isLoading || !data) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('users.detailTitle')}</h1>
      <Card>
        <CardContent className="py-4">
          <pre className="overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
            {JSON.stringify(data, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
