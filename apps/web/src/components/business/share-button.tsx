'use client';

import * as React from 'react';
import { Check, Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

/** Uses the native share sheet when available, otherwise copies the page link. */
export function ShareButton({ title }: { title: string }): React.ReactElement {
  const t = useTranslations('business');
  const [copied, setCopied] = React.useState(false);

  async function handleShare(): Promise<void> {
    const url = window.location.href.split('#')[0] ?? window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Share dismissed or clipboard blocked — nothing to recover.
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleShare}>
      {copied ? (
        <Check className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Share2 className="h-4 w-4" aria-hidden="true" />
      )}
      <span aria-live="polite">{copied ? t('linkCopied') : t('share')}</span>
    </Button>
  );
}
