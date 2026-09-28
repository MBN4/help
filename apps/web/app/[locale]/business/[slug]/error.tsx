'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

export default function BusinessProfileError({
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
    <div className="container flex flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="max-w-md text-muted-foreground">{t('description')}</p>
      <div className="flex gap-3">
        <Button onClick={() => reset()}>{t('retry')}</Button>
        <Button asChild variant="outline">
          <Link href="/">{t('backHome')}</Link>
        </Button>
      </div>
    </div>
  );
}
