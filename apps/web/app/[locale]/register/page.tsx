'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { registerRequestSchema } from '@buisnez/shared';
import { register as registerRequest } from '@/lib/api';
import { useInvalidateSession } from '@/lib/hooks/use-session';
import { authErrorKey } from '@/lib/utils/api-error-message';
import { Link } from '@/i18n/navigation';
import { AuthCard } from '@/components/auth/auth-card';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function RegisterPage(): React.ReactElement {
  const t = useTranslations('auth');
  const invalidateSession = useInvalidateSession();

  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);

    const parsed = registerRequestSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      setError(t('errorGeneric'));
      return;
    }

    setPending(true);
    try {
      await registerRequest(parsed.data);
      await invalidateSession();
      setSuccess(true);
    } catch (err) {
      setError(t(authErrorKey(err)));
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <AuthCard title={t('registerTitle')}>
        <p className="text-sm text-foreground/90">{t('registerSuccess')}</p>
        <Button asChild className="w-full">
          <Link href="/">{t('goHome')}</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('registerTitle')} subtitle={t('registerSubtitle')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">{t('nameLabel')}</Label>
          <Input
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('namePlaceholder')}
            required
          />
        </div>
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
          <Label htmlFor="password">{t('passwordLabel')}</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t('passwordPlaceholder')}
            minLength={8}
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {t('registerCta')}
        </Button>
      </form>

      <OAuthButtons />

      <p className="text-center text-sm text-muted-foreground">
        {t('haveAccount')}{' '}
        <Link
          href="/login"
          className="font-medium text-brand-700 hover:underline"
        >
          {t('loginLink')}
        </Link>
      </p>
    </AuthCard>
  );
}
