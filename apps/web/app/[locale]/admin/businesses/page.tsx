'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useSession } from '@/lib/hooks/use-session';
import {
  listAdminBusinesses,
  restoreBusiness,
  softDeleteBusiness,
  updateBusinessFeatured,
  updateBusinessStatus,
  updateBusinessVerify,
} from '@/lib/api';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ReasonDialog } from '@/components/admin/reason-dialog';

interface BusinessRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  isVerified: boolean;
  featured: boolean;
  deletedAt: string | null;
  category: { name: string };
  city: { name: string };
}

export default function AdminBusinessesPage(): React.ReactElement {
  const t = useTranslations('admin');
  const { user } = useSession();
  const isAdmin = user?.role === 'ADMIN';
  const queryClient = useQueryClient();
  const [q, setQ] = React.useState('');
  const [includeDeleted, setIncludeDeleted] = React.useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'businesses', q, includeDeleted],
    queryFn: () =>
      listAdminBusinesses({
        q: q || undefined,
        includeDeleted,
      }) as unknown as Promise<BusinessRow[]>,
  });
  const [suspendingId, setSuspendingId] = React.useState<string | null>(null);

  const invalidate = (): Promise<void> =>
    queryClient
      .invalidateQueries({ queryKey: ['admin', 'businesses'] })
      .then(() => undefined);

  const verifyMutation = useMutation({
    mutationFn: ({ id, isVerified }: { id: string; isVerified: boolean }) =>
      updateBusinessVerify(id, { isVerified }),
    onSuccess: invalidate,
  });
  const publishMutation = useMutation({
    mutationFn: (id: string) =>
      updateBusinessStatus(id, { status: 'PUBLISHED' }),
    onSuccess: invalidate,
  });
  const suspendMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      updateBusinessStatus(id, { status: 'SUSPENDED', reason }),
    onSuccess: invalidate,
  });
  const featuredMutation = useMutation({
    mutationFn: ({ id, featured }: { id: string; featured: boolean }) =>
      updateBusinessFeatured(id, { featured }),
    onSuccess: invalidate,
  });
  const softDeleteMutation = useMutation({
    mutationFn: softDeleteBusiness,
    onSuccess: invalidate,
  });
  const restoreMutation = useMutation({
    mutationFn: restoreBusiness,
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('businesses.title')}</h1>
        <div className="flex items-center gap-2">
          <Input
            placeholder={t('businesses.search')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-56"
          />
          <Button
            size="sm"
            variant={includeDeleted ? 'default' : 'outline'}
            onClick={() => setIncludeDeleted((v) => !v)}
          >
            {t('businesses.includeDeleted')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="space-y-3">
          {(data ?? []).map((business) => (
            <Card key={business.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium">
                    {business.name}{' '}
                    {business.deletedAt ? (
                      <Badge variant="secondary">
                        {t('businesses.deleted')}
                      </Badge>
                    ) : null}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {business.category.name} · {business.city.name} ·{' '}
                    {business.status}
                    {business.isVerified
                      ? ` · ${t('businesses.verified')}`
                      : ''}
                    {business.featured ? ` · ${t('businesses.featured')}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/admin/businesses/${business.id}`}>
                    <Button size="sm" variant="outline">
                      {t('businesses.viewDetail')}
                    </Button>
                  </Link>
                  {business.status !== 'PUBLISHED' ? (
                    <Button
                      size="sm"
                      onClick={() => publishMutation.mutate(business.id)}
                    >
                      {t('businesses.publish')}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setSuspendingId(business.id)}
                    >
                      {t('businesses.suspend')}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      verifyMutation.mutate({
                        id: business.id,
                        isVerified: !business.isVerified,
                      })
                    }
                  >
                    {business.isVerified
                      ? t('businesses.unverify')
                      : t('businesses.verify')}
                  </Button>
                  {isAdmin ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        featuredMutation.mutate({
                          id: business.id,
                          featured: !business.featured,
                        })
                      }
                    >
                      {business.featured
                        ? t('businesses.unfeature')
                        : t('businesses.feature')}
                    </Button>
                  ) : null}
                  {isAdmin ? (
                    business.deletedAt ? (
                      <Button
                        size="sm"
                        onClick={() => restoreMutation.mutate(business.id)}
                      >
                        {t('businesses.restore')}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => softDeleteMutation.mutate(business.id)}
                      >
                        {t('businesses.softDelete')}
                      </Button>
                    )
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ReasonDialog
        open={suspendingId !== null}
        onOpenChange={(open) => !open && setSuspendingId(null)}
        title={t('businesses.suspendTitle')}
        confirmLabel={t('businesses.suspend')}
        onConfirm={async (reason) => {
          if (suspendingId) {
            await suspendMutation.mutateAsync({ id: suspendingId, reason });
          }
        }}
      />
    </div>
  );
}
