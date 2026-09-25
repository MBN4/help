'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { getAdminBusiness } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Read-only detail view. Status/verify/featured/soft-delete controls live on the list page
 * (`/admin/businesses`); this page is the "drill-in" for the full record. A dedicated edit form was
 * time-boxed out of this pass — see PROGRESS.md's Phase 7 deviation log; `PATCH /admin/businesses/:id` is
 * fully implemented and testable via the API even though no form calls it yet.
 */
export default function AdminBusinessDetailPage(): React.ReactElement {
  const params = useParams<{ businessId: string }>();
  const t = useTranslations('admin');
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'businesses', params.businessId],
    queryFn: () => getAdminBusiness(params.businessId),
  });

  if (isLoading || !data) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('businesses.detailTitle')}</h1>
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
