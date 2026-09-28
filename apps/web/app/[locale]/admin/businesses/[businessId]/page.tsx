'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { getAdminBusiness } from '@/lib/api';
import { useSession } from '@/lib/hooks/use-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AdminBusinessEditForm,
  type AdminBusinessDetail,
} from '@/components/admin/admin-business-edit-form';

/**
 * Detail view: raw record plus (for ADMIN — `PATCH /admin/businesses/:id` is ADMIN-only) a full edit form.
 * Status/verify/featured/soft-delete controls still live on the list page (`/admin/businesses`); this page
 * is the "drill-in" for the full record and its editable fields (name, description, category, location,
 * contact info).
 */
export default function AdminBusinessDetailPage(): React.ReactElement {
  const params = useParams<{ businessId: string }>();
  const t = useTranslations('admin');
  const { user } = useSession();
  const queryClient = useQueryClient();
  const queryKey = ['admin', 'businesses', params.businessId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => getAdminBusiness(params.businessId),
  });

  if (isLoading || !data) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('businesses.detailTitle')}</h1>

      {user?.role === 'ADMIN' ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('businesses.editTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminBusinessEditForm
              business={data as unknown as AdminBusinessDetail}
              onSaved={() => {
                void queryClient.invalidateQueries({ queryKey });
                void queryClient.invalidateQueries({
                  queryKey: ['admin', 'businesses'],
                });
              }}
            />
          </CardContent>
        </Card>
      ) : null}

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
