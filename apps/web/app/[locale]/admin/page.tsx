'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { getAdminDashboard } from '@/lib/api';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminDashboardPage(): React.ReactElement {
  const t = useTranslations('admin');
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: getAdminDashboard,
  });

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  const tiles: { label: string; value: number; href: string }[] = [
    {
      label: t('dashboard.totalUsers'),
      value: data.totalUsers,
      href: '/admin/users',
    },
    {
      label: t('dashboard.totalReviews'),
      value: data.totalReviews,
      href: '/admin/content',
    },
    {
      label: t('dashboard.pendingClaims'),
      value: data.pendingClaimsCount,
      href: '/admin/claims',
    },
    {
      label: t('dashboard.openReports'),
      value: data.openReportsCount,
      href: '/admin/reports',
    },
    {
      label: t('dashboard.photosPending'),
      value: data.photosPendingCount,
      href: '/admin/content',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t('dashboard.title')}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <Link key={tile.label} href={tile.href}>
            <Card className="transition-colors hover:border-primary">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {tile.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{tile.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t('dashboard.businessesByStatus')}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.entries(data.businessesByStatus).map(([status, count]) => (
            <div key={status} className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">{status}</p>
              <p className="text-xl font-semibold">{count}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
