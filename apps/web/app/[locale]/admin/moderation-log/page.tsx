'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { listModerationLog } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminModerationLogPage(): React.ReactElement {
  const t = useTranslations('admin');
  const [action, setAction] = React.useState('');
  const [targetType, setTargetType] = React.useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'moderation-log', action, targetType],
    queryFn: () =>
      listModerationLog({
        action: action || undefined,
        targetType: targetType || undefined,
      }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('moderationLog.title')}</h1>
        <div className="flex gap-2">
          <Input
            placeholder={t('moderationLog.filterAction')}
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="w-48"
          />
          <Input
            placeholder={t('moderationLog.filterTargetType')}
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            className="w-48"
          />
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((entry) => (
            <Card key={entry.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <Badge>{entry.action}</Badge>
                  <span className="text-muted-foreground">
                    {entry.targetType} · {entry.targetId}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>{entry.actorName ?? entry.actorId}</span>
                  <span>{new Date(entry.createdAt).toLocaleString()}</span>
                </div>
                {entry.reason ? (
                  <p className="w-full text-muted-foreground">{entry.reason}</p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
