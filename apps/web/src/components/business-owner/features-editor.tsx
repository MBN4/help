'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { BusinessManageProfile } from '@buisnez/shared';
import { ApiError, updateBusinessFeatures } from '@/lib/api';
import { useFeatures } from '@/lib/hooks/use-features';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function FeaturesEditor({
  business,
  onSaved,
}: {
  business: BusinessManageProfile;
  onSaved: (business: BusinessManageProfile) => void;
}): React.ReactElement {
  const t = useTranslations('businessOwner');
  const { data: features, isLoading } = useFeatures();

  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(business.features.map((f) => f.id)),
  );
  const [pending, setPending] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function toggle(id: string): void {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setPending(true);
    setSaved(false);
    setError(null);
    try {
      const { data } = await updateBusinessFeatures(business.id, {
        featureIds: Array.from(selected),
      });
      onSaved(data);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errorGeneric'));
    } finally {
      setPending(false);
    }
  }

  if (isLoading) {
    return <Skeleton className="h-24 w-full max-w-xl" />;
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {features?.map((feature) => (
          <label key={feature.id} className="flex items-center gap-1.5 text-sm">
            <Checkbox
              checked={selected.has(feature.id)}
              onCheckedChange={() => toggle(feature.id)}
            />
            {feature.name}
          </label>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-success">{t('savedSuccess')}</p>}

      <Button type="submit" disabled={pending}>
        {t('saveChanges')}
      </Button>
    </form>
  );
}
