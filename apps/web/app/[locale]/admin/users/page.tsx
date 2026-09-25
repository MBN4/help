'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { banUser, changeUserRole, listAdminUsers, unbanUser } from '@/lib/api';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ReasonDialog } from '@/components/admin/reason-dialog';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isBanned: boolean;
  reviewCount: number;
  businessOwnershipCount: number;
}

const ROLES = ['CUSTOMER', 'BUSINESS_OWNER', 'MODERATOR', 'ADMIN'] as const;

export default function AdminUsersPage(): React.ReactElement {
  const t = useTranslations('admin');
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: () =>
      listAdminUsers(search || undefined) as unknown as Promise<UserRow[]>,
  });
  const [banningId, setBanningId] = React.useState<string | null>(null);

  const invalidate = (): Promise<void> =>
    queryClient
      .invalidateQueries({ queryKey: ['admin', 'users'] })
      .then(() => undefined);

  const unbanMutation = useMutation({
    mutationFn: unbanUser,
    onSuccess: invalidate,
  });
  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      changeUserRole(id, { role: role as never }),
    onSuccess: invalidate,
  });
  const banMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      banUser(id, { reason }),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('users.title')}</h1>
        <Input
          placeholder={t('users.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56"
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="space-y-3">
          {(data ?? []).map((user) => (
            <Card key={user.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium">
                    {user.name}{' '}
                    {user.isBanned ? (
                      <Badge variant="secondary">{t('users.banned')}</Badge>
                    ) : null}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {user.email} · {user.reviewCount} reviews ·{' '}
                    {user.businessOwnershipCount} businesses
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/users/${user.id}`}>
                    <Button size="sm" variant="outline">
                      {t('users.viewDetail')}
                    </Button>
                  </Link>
                  <Select
                    defaultValue={user.role}
                    onValueChange={(role) =>
                      roleMutation.mutate({ id: user.id, role })
                    }
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {user.isBanned ? (
                    <Button
                      size="sm"
                      onClick={() => unbanMutation.mutate(user.id)}
                    >
                      {t('users.unban')}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setBanningId(user.id)}
                    >
                      {t('users.ban')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ReasonDialog
        open={banningId !== null}
        onOpenChange={(open) => !open && setBanningId(null)}
        title={t('users.banTitle')}
        confirmLabel={t('users.ban')}
        onConfirm={async (reason) => {
          if (banningId) {
            await banMutation.mutateAsync({ id: banningId, reason });
          }
        }}
      />
    </div>
  );
}
