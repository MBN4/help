'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { loginRequestSchema } from '@buisnez/shared';
import { login as loginRequest } from '@/lib/api';
import { useInvalidateSession } from '@/lib/hooks/use-session';
import { authErrorKey } from '@/lib/utils/api-error-message';
import { Link, useRouter } from '@/i18n/navigation';
import { AuthCard } from '@/components/auth/auth-card';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function LoginPage(): React.ReactElement {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const invalidateSession = useInvalidateSession();
  const returnTo = searchParams.get('returnTo');

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);

    const parsed = loginRequestSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(t('errorGeneric'));
      return;
    }

    setPending(true);
    try {
      await loginRequest(parsed.data);
      await invalidateSession();
      router.push(returnTo && returnTo.startsWith('/') ? returnTo : '/');
    } catch (err) {
      setError(t(authErrorKey(err)));
      setPending(false);
    }
  }

  return (
    <AuthCard
      title={t('loginTitle')}
      subtitle={returnTo ? t('returnToNotice') : t('loginSubtitle')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t('emailLabel')}</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t('emailPlaceholder')}
            required
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t('passwordLabel')}</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-primary hover:underline"
            >
              {t('forgotPasswordLink')}
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {t('loginCta')}
        </Button>
      </form>

      <OAuthButtons />

      <p className="text-center text-sm text-muted-foreground">
        {t('noAccount')}{' '}
        <Link
          href="/register"
          className="font-medium text-primary hover:underline"
        >
          {t('signupLink')}
        </Link>
      </p>
    </AuthCard>
  );
}
