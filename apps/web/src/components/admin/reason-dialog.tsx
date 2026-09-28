'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  reasonRequired?: boolean;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: (reason: string) => Promise<void> | void;
}

/**
 * Real confirm-with-reason dialog for every destructive admin/moderator action (remove content, ban, reject,
 * soft-delete) — never a bare `window.confirm()`. See docs/12-admin-panel.md.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  reasonRequired = true,
  confirmLabel,
  destructive = true,
  onConfirm,
}: ReasonDialogProps): React.ReactElement {
  const t = useTranslations('admin.reasonDialog');
  const [reason, setReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  const handleConfirm = async (): Promise<void> => {
    if (reasonRequired && !reason.trim()) {
      setError(t('reasonRequiredError'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={
            reasonRequired
              ? t('reasonRequiredPlaceholder')
              : t('reasonOptionalPlaceholder')
          }
          rows={4}
        />
        {error ? (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        ) : null}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t('cancel')}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? t('working') : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
