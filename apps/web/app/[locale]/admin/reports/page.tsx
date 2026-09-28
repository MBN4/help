'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { dismissReport, listAdminReports, resolveReport } from '@/lib/api';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ReasonDialog } from '@/components/admin/reason-dialog';

interface ReportGroup {
  targetType: string;
  targetId: string;
  count: number;
  target: Record<string, unknown> | null;
  reports: { id: string; reason: string; message: string | null }[];
}

function targetLabel(group: ReportGroup): string {
  const target = group.target;
  if (!target) return group.targetId;
  if (typeof target.name === 'string') return target.name; // business
  if (typeof target.body === 'string')
    return `Review: "${String(target.body).slice(0, 60)}"`;
  if (typeof target.url === 'string') return 'Photo';
  if (typeof target.email === 'string') return `User: ${String(target.email)}`;
  return group.targetId;
}

export default function AdminReportsPage(): React.ReactElement {
  const t = useTranslations('admin');
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports'],
    queryFn: () =>
      listAdminReports('PENDING') as unknown as Promise<ReportGroup[]>,
  });
  const [dismissingReportId, setDismissingReportId] = React.useState<
    string | null
  >(null);
  const [resolvingReportId, setResolvingReportId] = React.useState<
    string | null
  >(null);
  const [restoringReportId, setRestoringReportId] = React.useState<
    string | null
  >(null);

  const resolveMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      resolveReport(id, {
        reason: reason || undefined,
        action: 'REMOVE_CONTENT',
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] }),
  });

  const restoreMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      resolveReport(id, {
        reason: reason || undefined,
        action: 'RESTORE_CONTENT',
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] }),
  });

  const dismissMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      dismissReport(id, { reason: reason || undefined }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] }),
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const groups = data ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('reports.title')}</h1>
      {groups.length === 0 ? (
        <p className="text-muted-foreground">{t('reports.empty')}</p>
      ) : (
        groups.map((group) => {
          const firstReportId = group.reports[0]?.id;
          return (
            <Card key={`${group.targetType}:${group.targetId}`}>
              <CardContent className="flex flex-col gap-2 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge>{group.targetType}</Badge>
                    <p className="font-medium">{targetLabel(group)}</p>
                  </div>
                  <Badge variant="secondary">
                    {t('reports.reportCount', { count: group.count })}
                  </Badge>
                </div>
                <ul className="text-sm text-muted-foreground">
                  {group.reports.map((r) => (
                    <li key={r.id}>
                      {r.reason}
                      {r.message ? ` — ${r.message}` : ''}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/admin/reports/${firstReportId}`}>
                    <Button size="sm" variant="outline">
                      {t('reports.viewDetail')}
                    </Button>
                  </Link>
                  {(group.targetType === 'REVIEW' ||
                    group.targetType === 'PHOTO') &&
                  firstReportId ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setResolvingReportId(firstReportId)}
                    >
                      {t('reports.removeContent')}
                    </Button>
                  ) : null}
                  {(group.targetType === 'REVIEW' ||
                    group.targetType === 'PHOTO') &&
                  firstReportId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRestoringReportId(firstReportId)}
                    >
                      {t('reports.restoreContent')}
                    </Button>
                  ) : null}
                  {firstReportId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDismissingReportId(firstReportId)}
                    >
                      {t('reports.dismiss')}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      <ReasonDialog
        open={resolvingReportId !== null}
        onOpenChange={(open) => !open && setResolvingReportId(null)}
        title={t('reports.resolveTitle')}
        confirmLabel={t('reports.removeContent')}
        onConfirm={async (reason) => {
          if (resolvingReportId) {
            await resolveMutation.mutateAsync({
              id: resolvingReportId,
              reason,
            });
          }
        }}
      />
      <ReasonDialog
        open={restoringReportId !== null}
        onOpenChange={(open) => !open && setRestoringReportId(null)}
        title={t('reports.restoreTitle')}
        reasonRequired={false}
        destructive={false}
        confirmLabel={t('reports.restoreContent')}
        onConfirm={async (reason) => {
          if (restoringReportId) {
            await restoreMutation.mutateAsync({
              id: restoringReportId,
              reason,
            });
          }
        }}
      />
      <ReasonDialog
        open={dismissingReportId !== null}
        onOpenChange={(open) => !open && setDismissingReportId(null)}
        title={t('reports.dismissTitle')}
        reasonRequired={false}
        destructive={false}
        confirmLabel={t('reports.dismiss')}
        onConfirm={async (reason) => {
          if (dismissingReportId) {
            await dismissMutation.mutateAsync({
              id: dismissingReportId,
              reason,
            });
          }
        }}
      />
    </div>
  );
}
