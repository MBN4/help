'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ApiError, changeUserRole, getAdminUser } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ROLES = ['CUSTOMER', 'BUSINESS_OWNER', 'MODERATOR', 'ADMIN'] as const;

/**
 * Detail view: raw record plus a role-change control. Ban/unban already live inline on the list page
 * (`/admin/users`) with a `ReasonDialog` confirmation (bans require a reason per `banUserRequestSchema`) —
 * not duplicated here. Role changes have no reason field in `changeUserRoleRequestSchema` and the list
 * page's own role `<Select>` applies immediately with no extra confirmation step, so this control matches
 * that same immediate-apply UX for consistency rather than introducing a new confirm dialog.
 */
export default function AdminUserDetailPage(): React.ReactElement {
  const params = useParams<{ userId: string }>();
  const t = useTranslations('admin');
  const queryClient = useQueryClient();
  const queryKey = ['admin', 'users', params.userId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => getAdminUser(params.userId),
  });
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const roleMutation = useMutation({
    mutationFn: (role: string) =>
      changeUserRole(params.userId, { role: role as never }),
    onSuccess: () => {
      setSaved(true);
      setError(null);
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err) => {
      setSaved(false);
      setError(err instanceof ApiError ? err.message : t('users.errorGeneric'));
    },
  });

  if (isLoading || !data) {
    return <Skeleton className="h-64 w-full" />;
  }

  const currentRole = String(data.role ?? '');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('users.detailTitle')}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t('users.changeRole')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Select
            defaultValue={currentRole}
            onValueChange={(role) => roleMutation.mutate(role)}
          >
            <SelectTrigger className="w-56">
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
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {saved ? (
            <p className="text-sm text-success">{t('users.savedSuccess')}</p>
          ) : null}
        </CardContent>
      </Card>

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
