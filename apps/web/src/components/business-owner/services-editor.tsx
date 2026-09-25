'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { formatPKR, type BusinessServiceItem } from '@buisnez/shared';
import {
  ApiError,
  createBusinessService,
  deleteBusinessService,
  updateBusinessService,
} from '@/lib/api';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface DraftService {
  name: string;
  description: string;
  priceInPkr: string;
  isAvailable: boolean;
}

const EMPTY_DRAFT: DraftService = {
  name: '',
  description: '',
  priceInPkr: '',
  isAvailable: true,
};

export function ServicesEditor({
  businessId,
  services,
  onChange,
}: {
  businessId: string;
  services: BusinessServiceItem[];
  onChange: (services: BusinessServiceItem[]) => void;
}): React.ReactElement {
  const t = useTranslations('businessOwner');

  const [draft, setDraft] = React.useState<DraftService>(EMPTY_DRAFT);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState<DraftService>(EMPTY_DRAFT);

  function toPaisa(pkr: string): number | undefined {
    const trimmed = pkr.trim();
    if (!trimmed) {
      return undefined;
    }
    const value = Number(trimmed);
    if (Number.isNaN(value) || value < 0) {
      return undefined;
    }
    return Math.round(value * 100);
  }

  async function handleAdd(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    if (!draft.name.trim()) {
      return;
    }
    setPending(true);
    try {
      const { data } = await createBusinessService(businessId, {
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        priceInPaisa: toPaisa(draft.priceInPkr),
        isAvailable: draft.isAvailable,
      });
      onChange([...services, data]);
      setDraft(EMPTY_DRAFT);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errorGeneric'));
    } finally {
      setPending(false);
    }
  }

  function startEdit(service: BusinessServiceItem): void {
    setEditingId(service.id);
    setEditDraft({
      name: service.name,
      description: service.description ?? '',
      priceInPkr:
        service.priceInPaisa != null ? String(service.priceInPaisa / 100) : '',
      isAvailable: service.isAvailable,
    });
  }

  async function handleSaveEdit(serviceId: string): Promise<void> {
    setError(null);
    setPending(true);
    try {
      const { data } = await updateBusinessService(businessId, serviceId, {
        name: editDraft.name.trim() || undefined,
        description: editDraft.description.trim(),
        priceInPaisa: toPaisa(editDraft.priceInPkr),
        isAvailable: editDraft.isAvailable,
      });
      onChange(services.map((s) => (s.id === serviceId ? data : s)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errorGeneric'));
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(serviceId: string): Promise<void> {
    setError(null);
    setPending(true);
    try {
      await deleteBusinessService(businessId, serviceId);
      onChange(services.filter((s) => s.id !== serviceId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errorGeneric'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="space-y-3">
        {services.map((service) =>
          editingId === service.id ? (
            <Card key={service.id}>
              <CardContent className="space-y-2 p-4">
                <Input
                  value={editDraft.name}
                  onChange={(event) =>
                    setEditDraft((d) => ({ ...d, name: event.target.value }))
                  }
                  placeholder={t('services.nameLabel')}
                />
                <Textarea
                  value={editDraft.description}
                  onChange={(event) =>
                    setEditDraft((d) => ({
                      ...d,
                      description: event.target.value,
                    }))
                  }
                  placeholder={t('services.descriptionLabel')}
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editDraft.priceInPkr}
                  onChange={(event) =>
                    setEditDraft((d) => ({
                      ...d,
                      priceInPkr: event.target.value,
                    }))
                  }
                  placeholder={t('services.priceLabel')}
                />
                <label className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={editDraft.isAvailable}
                    onCheckedChange={(checked) =>
                      setEditDraft((d) => ({
                        ...d,
                        isAvailable: Boolean(checked),
                      }))
                    }
                  />
                  {t('services.availableLabel')}
                </label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    onClick={() => handleSaveEdit(service.id)}
                  >
                    {t('saveChanges')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingId(null)}
                  >
                    {t('cancel')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card key={service.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{service.name}</p>
                  {service.description && (
                    <p className="text-sm text-muted-foreground">
                      {service.description}
                    </p>
                  )}
                  <p className="text-sm">
                    {service.priceInPaisa != null
                      ? formatPKR(service.priceInPaisa)
                      : t('services.noPrice')}
                    {!service.isAvailable && (
                      <span className="ms-2 text-xs text-muted-foreground">
                        ({t('services.unavailable')})
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => startEdit(service)}
                  >
                    {t('edit')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={() => handleDelete(service.id)}
                  >
                    {t('remove')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ),
        )}
      </div>

      <form
        onSubmit={handleAdd}
        className="space-y-2 rounded-lg border border-border p-4"
      >
        <h3 className="font-medium">{t('services.addTitle')}</h3>
        <div className="space-y-1.5">
          <Label htmlFor="service-name">{t('services.nameLabel')}</Label>
          <Input
            id="service-name"
            value={draft.name}
            onChange={(event) =>
              setDraft((d) => ({ ...d, name: event.target.value }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="service-description">
            {t('services.descriptionLabel')}
          </Label>
          <Textarea
            id="service-description"
            value={draft.description}
            onChange={(event) =>
              setDraft((d) => ({ ...d, description: event.target.value }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="service-price">{t('services.priceLabel')}</Label>
          <Input
            id="service-price"
            type="number"
            min={0}
            step="0.01"
            value={draft.priceInPkr}
            onChange={(event) =>
              setDraft((d) => ({ ...d, priceInPkr: event.target.value }))
            }
          />
        </div>
        <label className="flex items-center gap-1.5 text-sm">
          <Checkbox
            checked={draft.isAvailable}
            onCheckedChange={(checked) =>
              setDraft((d) => ({ ...d, isAvailable: Boolean(checked) }))
            }
          />
          {t('services.availableLabel')}
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="sm" disabled={pending}>
          {t('services.add')}
        </Button>
      </form>
    </div>
  );
}
