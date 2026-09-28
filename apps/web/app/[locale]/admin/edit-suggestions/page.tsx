'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { listAdminEditSuggestions, resolveEditSuggestion } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminEditSuggestionsPage(): React.ReactElement {
  const t = useTranslations('admin');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'edit-suggestions'],
    queryFn: () => listAdminEditSuggestions({ status: 'PENDING' }),
  });

  const resolveMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: 'ACCEPTED' | 'REJECTED';
    }) => resolveEditSuggestion(id, { status }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['admin', 'edit-suggestions'],
      }),
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const suggestions = data ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('editSuggestions.title')}</h1>
      {suggestions.length === 0 ? (
        <p className="text-muted-foreground">{t('editSuggestions.empty')}</p>
      ) : (
        <div className="space-y-3">
          {suggestions.map((suggestion) => (
            <Card key={suggestion.id}>
              <CardContent className="space-y-2 py-4">
                <p className="font-medium">{suggestion.business.name}</p>
                <p className="text-sm text-muted-foreground">
                  {t('editSuggestions.field')}: {suggestion.field}
                </p>
                {suggestion.currentValue ? (
                  <p className="text-sm">
                    {t('editSuggestions.currentValue')}:{' '}
                    {suggestion.currentValue}
                  </p>
                ) : null}
                <p className="text-sm">
                  {t('editSuggestions.suggestedValue')}:{' '}
                  {suggestion.suggestedValue}
                </p>
                {suggestion.note ? (
                  <p className="text-sm text-muted-foreground">
                    {suggestion.note}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {suggestion.userName}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      resolveMutation.mutate({
                        id: suggestion.id,
                        status: 'ACCEPTED',
                      })
                    }
                  >
                    {t('editSuggestions.accept')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      resolveMutation.mutate({
                        id: suggestion.id,
                        status: 'REJECTED',
                      })
                    }
                  >
                    {t('editSuggestions.reject')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
