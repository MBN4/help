'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { approveClaim, listAdminClaims, rejectClaim } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ReasonDialog } from '@/components/admin/reason-dialog';

interface ClaimRow {
  id: string;
  status: string;
  message: string | null;
  documentUrl: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
  business: { id: string; name: string; slug: string };
}

export default function AdminClaimsPage(): React.ReactElement {
  const t = useTranslations('admin');
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'claims'],
    queryFn: () => listAdminClaims('PENDING') as unknown as Promise<ClaimRow[]>,
  });
  const [verifyMap, setVerifyMap] = React.useState<Record<string, boolean>>({});
  const [rejectingId, setRejectingId] = React.useState<string | null>(null);

  const approveMutation = useMutation({
    mutationFn: (claimId: string) =>
      approveClaim(claimId, { verifyBusiness: verifyMap[claimId] ?? false }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'claims'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ claimId, reason }: { claimId: string; reason: string }) =>
      rejectClaim(claimId, { reason: reason || undefined }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'claims'] }),
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const claims = data ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('claims.title')}</h1>
      {claims.length === 0 ? (
        <p className="text-muted-foreground">{t('claims.empty')}</p>
      ) : (
        claims.map((claim) => (
          <Card key={claim.id}>
            <CardContent className="flex flex-col gap-3 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{claim.business.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('claims.claimant')}: {claim.user.name} (
                    {claim.user.email})
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(claim.createdAt).toLocaleString()}
                </p>
              </div>
              {claim.message ? (
                <p className="text-sm">{claim.message}</p>
              ) : null}
              {claim.documentUrl ? (
                <a
                  href={claim.documentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-saffron-700 underline"
                >
                  {t('claims.viewDocument')}
                </a>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={verifyMap[claim.id] ?? false}
                    onCheckedChange={(checked) =>
                      setVerifyMap((prev) => ({
                        ...prev,
                        [claim.id]: Boolean(checked),
                      }))
                    }
                  />
                  {t('claims.alsoVerify')}
                </label>
                <Button
                  size="sm"
                  onClick={() => approveMutation.mutate(claim.id)}
                  disabled={approveMutation.isPending}
                >
                  {t('claims.approve')}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setRejectingId(claim.id)}
                >
                  {t('claims.reject')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <ReasonDialog
        open={rejectingId !== null}
        onOpenChange={(open) => !open && setRejectingId(null)}
        title={t('claims.rejectTitle')}
        reasonRequired={false}
        confirmLabel={t('claims.reject')}
        onConfirm={async (reason) => {
          if (rejectingId) {
            await rejectMutation.mutateAsync({ claimId: rejectingId, reason });
          }
        }}
      />
    </div>
  );
}
