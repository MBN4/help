'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type {
  BusinessHoursUpdate,
  BusinessManageProfile,
} from '@buisnez/shared';
import { ApiError, updateBusinessHours } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';

const DAY_ORDER = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

type DayRow = BusinessHoursUpdate[number];

function buildInitialRows(business: BusinessManageProfile): DayRow[] {
  return DAY_ORDER.map((day) => {
    const existing = business.hours.find((h) => h.dayOfWeek === day);
    return {
      dayOfWeek: day,
      opensAt: existing?.opensAt ?? '09:00',
      closesAt: existing?.closesAt ?? '18:00',
      isClosed: existing?.isClosed ?? false,
    };
  });
}

export function HoursEditor({
  business,
  onSaved,
}: {
  business: BusinessManageProfile;
  onSaved: (business: BusinessManageProfile) => void;
}): React.ReactElement {
  const t = useTranslations('businessOwner');
  const dayT = useTranslations('business');

  const [rows, setRows] = React.useState<DayRow[]>(() =>
    buildInitialRows(business),
  );
  const [pending, setPending] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function updateRow(index: number, patch: Partial<DayRow>): void {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setPending(true);
    setSaved(false);
    setError(null);
    try {
      const { data } = await updateBusinessHours(business.id, rows);
      onSaved(data);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errorGeneric'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div
            key={row.dayOfWeek}
            className="flex flex-wrap items-center gap-3 border-b border-border py-2 last:border-0"
          >
            <span className="w-24 text-sm font-medium">
              {dayT(`days.${row.dayOfWeek}`)}
            </span>
            <Input
              type="time"
              className="w-32"
              value={row.opensAt ?? ''}
              disabled={row.isClosed}
              onChange={(event) =>
                updateRow(index, { opensAt: event.target.value || null })
              }
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="time"
              className="w-32"
              value={row.closesAt ?? ''}
              disabled={row.isClosed}
              onChange={(event) =>
                updateRow(index, { closesAt: event.target.value || null })
              }
            />
            <label className="ms-auto flex items-center gap-1.5 text-sm">
              <Checkbox
                checked={row.isClosed}
                onCheckedChange={(checked) =>
                  updateRow(index, { isClosed: Boolean(checked) })
                }
              />
              {dayT('closed')}
            </label>
          </div>
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
