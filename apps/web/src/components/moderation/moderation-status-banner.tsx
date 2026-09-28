'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { createAppeal, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';

const REASON_KEYS = [
  'DUPLICATE_TEXT',
  'SPAM_LINKS',
  'REVIEW_BOMBING',
  'IP_BURST',
  'ACCOUNT_BURST',
  'LOW_TRUST_ACCOUNT',
  'NEW_ACCOUNT_FLOOD',
] as const;

/** Held (PENDING) or removed content, shown on the account "my reviews"/"my photos" pages with a reason and
 * an appeal path — see docs/11-reviews-trust-safety.md's "Fairness & recourse" section. */
export function ModerationStatusBanner({
  targetType,
  targetId,
  status,
  moderationReason,
}: {
  targetType: 'REVIEW' | 'PHOTO';
  targetId: string;
  status: string;
  moderationReason: string | null;
}): React.ReactElement | null {
  const t = useTranslations('moderation');
  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [alreadyAppealed, setAlreadyAppealed] = React.useState(false);

  if (status !== 'PENDING' && status !== 'REMOVED') {
    return null;
  }

  const reasons = (moderationReason ?? '')
    .split(',')
    .map((r) => r.trim())
    .filter((r): r is (typeof REASON_KEYS)[number] =>
      (REASON_KEYS as readonly string[]).includes(r),
    );

  async function handleSubmit(): Promise<void> {
    setPending(true);
    try {
      await createAppeal({
        targetType,
        targetId,
        message: message.trim() || undefined,
      });
      setDone(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setAlreadyAppealed(true);
      } else {
        throw error;
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-1.5 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
      <Badge variant={status === 'REMOVED' ? 'default' : 'warning'}>
        {status === 'REMOVED' ? t('statusRemoved') : t('statusPending')}
      </Badge>
      {(reasons.length > 0 || moderationReason) && (
        <p className="text-muted-foreground">
          {t('reasonPrefix')}:{' '}
          {reasons.length > 0
            ? reasons.map((r) => t(`reasons.${r}`)).join('; ')
            : moderationReason}
        </p>
      )}
      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setDone(false);
            setMessage('');
          }
        }}
      >
        <SheetTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            {t('appealCta')}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>{t('appealCta')}</SheetTitle>
          </SheetHeader>
          {done ? (
            <p className="pt-3 text-sm text-foreground/90">{t('appealSent')}</p>
          ) : alreadyAppealed ? (
            <p className="pt-3 text-sm text-foreground/90">
              {t('appealAlreadySent')}
            </p>
          ) : (
            <div className="space-y-4 pt-3">
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={t('appealMessageLabel')}
                maxLength={1000}
              />
              <div className="flex gap-2">
                <Button type="button" onClick={handleSubmit} disabled={pending}>
                  {t('appealSubmit')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  {t('cancel')}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
