'use client';

import * as React from 'react';
import { Flag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReportReasonValue, ReportTargetTypeValue } from '@buisnez/shared';
import { createReport } from '@/lib/api';

// 'APPEAL' is a server-set-only reason (see docs/11-reviews-trust-safety.md) — never selectable here.
type UserReportReason = Exclude<ReportReasonValue, 'APPEAL'>;
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const REASONS: { value: UserReportReason; labelKey: string }[] = [
  { value: 'SPAM', labelKey: 'reasonSpam' },
  { value: 'INAPPROPRIATE', labelKey: 'reasonInappropriate' },
  { value: 'FAKE', labelKey: 'reasonFake' },
  { value: 'CLOSED', labelKey: 'reasonClosed' },
  { value: 'DUPLICATE', labelKey: 'reasonDuplicate' },
  { value: 'OTHER', labelKey: 'reasonOther' },
];

const TARGET_LABEL_KEY: Record<ReportTargetTypeValue, string> = {
  BUSINESS: 'targetBusiness',
  REVIEW: 'targetReview',
  PHOTO: 'targetPhoto',
  USER: 'targetUser',
};

export function ReportButton({
  targetType,
  targetId,
}: {
  targetType: ReportTargetTypeValue;
  targetId: string;
}): React.ReactElement | null {
  const t = useTranslations('report');
  const { isAuthenticated } = useSession();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState<UserReportReason>('SPAM');
  const [message, setMessage] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);

  if (!isAuthenticated) {
    return null;
  }

  async function handleSubmit(): Promise<void> {
    setPending(true);
    try {
      await createReport({
        targetType,
        targetId,
        reason,
        message: message.trim() || undefined,
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
        if (!next) {
          setDone(false);
          setMessage('');
        }
      }}
    >
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
        >
          <Flag className="h-3.5 w-3.5" aria-hidden="true" />
          {t('reportContent')}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>
            {t('reportTitle', { target: t(TARGET_LABEL_KEY[targetType]) })}
          </SheetTitle>
        </SheetHeader>
        {done ? (
          <p className="pt-3 text-sm text-foreground/90">
            {t('submitSuccess')}
          </p>
        ) : (
          <div className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label>{t('reasonLabel')}</Label>
              <Select
                value={reason}
                onValueChange={(value) => setReason(value as UserReportReason)}
              >
                <SelectTrigger>
                  <SelectValue>
                    {t(
                      REASONS.find((r) => r.value === reason)?.labelKey ??
                        'reasonOther',
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-message">{t('detailsLabel')}</Label>
              <Textarea
                id="report-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={1000}
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={handleSubmit} disabled={pending}>
                {t('submit')}
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
  );
}
