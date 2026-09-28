'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  const t = useTranslations('errors');

  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="max-w-md text-muted-foreground">
        {t('accountErrorDescription')}
      </p>
      <Button onClick={() => reset()}>{t('retry')}</Button>
    </div>
  );
}
