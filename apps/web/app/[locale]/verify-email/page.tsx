'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { verifyEmail } from '@/lib/api';
import { useInvalidateSession } from '@/lib/hooks/use-session';
import { Link } from '@/i18n/navigation';
import { AuthCard } from '@/components/auth/auth-card';
import { Button } from '@/components/ui/button';

type Status = 'pending' | 'success' | 'error';

export default function VerifyEmailPage(): React.ReactElement {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const invalidateSession = useInvalidateSession();
  const token = searchParams.get('token');
  const [status, setStatus] = React.useState<Status>('pending');

  React.useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }
    verifyEmail({ token })
      .then(async () => {
        await invalidateSession();
        setStatus('success');
      })
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <AuthCard title={t('verifyEmailTitle')}>
      {status === 'pending' && (
        <p className="text-sm text-muted-foreground">{t('verifyEmailTitle')}</p>
      )}
      {status === 'success' && (
        <>
          <p className="text-sm text-foreground/90">
            {t('verifyEmailSuccess')}
          </p>
          <Button asChild className="w-full">
            <Link href="/">{t('goHome')}</Link>
          </Button>
        </>
      )}
      {status === 'error' && (
        <>
          <p className="text-sm text-destructive">{t('verifyEmailError')}</p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">{t('goToLogin')}</Link>
          </Button>
        </>
      )}
    </AuthCard>
  );
}
