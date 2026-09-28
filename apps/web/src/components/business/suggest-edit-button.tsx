'use client';

import * as React from 'react';
import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { suggestBusinessEdit } from '@/lib/api';
import { useSession } from '@/lib/hooks/use-session';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export function SuggestEditButton({
  businessId,
}: {
  businessId: string;
}): React.ReactElement | null {
  const t = useTranslations('business');
  const { isAuthenticated } = useSession();
  const [open, setOpen] = React.useState(false);
  const [field, setField] = React.useState('');
  const [currentValue, setCurrentValue] = React.useState('');
  const [suggestedValue, setSuggestedValue] = React.useState('');
  const [note, setNote] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);

  if (!isAuthenticated) {
    return null;
  }

  function reset(): void {
    setField('');
    setCurrentValue('');
    setSuggestedValue('');
    setNote('');
    setDone(false);
  }

  async function handleSubmit(): Promise<void> {
    if (!field.trim() || !suggestedValue.trim()) return;
    setPending(true);
    try {
      await suggestBusinessEdit(businessId, {
        field: field.trim(),
        currentValue: currentValue.trim() || undefined,
        suggestedValue: suggestedValue.trim(),
        note: note.trim() || undefined,
      });
      setDone(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          {t('suggestEdit')}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{t('suggestEditTitle')}</SheetTitle>
        </SheetHeader>
        {done ? (
          <p className="pt-3 text-sm text-foreground/90">
            {t('suggestEditSuccess')}
          </p>
        ) : (
          <div className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="suggest-edit-field">
                {t('suggestEditField')}
              </Label>
              <Input
                id="suggest-edit-field"
                value={field}
                onChange={(event) => setField(event.target.value)}
                placeholder={t('suggestEditFieldPlaceholder')}
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="suggest-edit-current">
                {t('suggestEditCurrentValue')}
              </Label>
              <Input
                id="suggest-edit-current"
                value={currentValue}
                onChange={(event) => setCurrentValue(event.target.value)}
                maxLength={1000}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="suggest-edit-suggested">
                {t('suggestEditSuggestedValue')}
              </Label>
              <Input
                id="suggest-edit-suggested"
                value={suggestedValue}
                onChange={(event) => setSuggestedValue(event.target.value)}
                maxLength={1000}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="suggest-edit-note">{t('suggestEditNote')}</Label>
              <Textarea
                id="suggest-edit-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={1000}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={pending || !field.trim() || !suggestedValue.trim()}
              >
                {t('suggestEditSubmit')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                {t('suggestEditCancel')}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
