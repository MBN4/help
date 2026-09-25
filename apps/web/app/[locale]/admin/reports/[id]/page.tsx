'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { dismissReport, getAdminReportDetail, resolveReport } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ReasonDialog } from '@/components/admin/reason-dialog';

export default function AdminReportDetailPage(): React.ReactElement {
  const params = useParams<{ id: string }>();
  const t = useTranslations('admin');
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports', params.id],
    queryFn: () => getAdminReportDetail(params.id),
  });
  const [resolving, setResolving] = React.useState(false);
  const [dismissing, setDismissing] = React.useState(false);

  const resolveMutation = useMutation({
    mutationFn: (reason: string) =>
      resolveReport(params.id, {
        reason: reason || undefined,
        action: 'REMOVE_CONTENT',
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['admin', 'reports', params.id],
      }),
  });
  const dismissMutation = useMutation({
    mutationFn: (reason: string) =>
      dismissReport(params.id, { reason: reason || undefined }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['admin', 'reports', params.id],
      }),
  });

  if (isLoading || !data) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('reports.detailTitle')}</h1>
      <Card>
        <CardContent className="space-y-2 py-4">
          <pre className="overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
            {JSON.stringify(data, null, 2)}
          </pre>
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Button variant="destructive" onClick={() => setResolving(true)}>
          {t('reports.removeContent')}
        </Button>
        <Button variant="outline" onClick={() => setDismissing(true)}>
          {t('reports.dismiss')}
        </Button>
      </div>

      <ReasonDialog
        open={resolving}
        onOpenChange={setResolving}
        title={t('reports.resolveTitle')}
        confirmLabel={t('reports.removeContent')}
        onConfirm={(reason) => resolveMutation.mutateAsync(reason)}
      />
      <ReasonDialog
        open={dismissing}
        onOpenChange={setDismissing}
        title={t('reports.dismissTitle')}
        reasonRequired={false}
        destructive={false}
        confirmLabel={t('reports.dismiss')}
        onConfirm={(reason) => dismissMutation.mutateAsync(reason)}
      />
    </div>
  );
}
