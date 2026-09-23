'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { resetPasswordRequestSchema } from '@buisnez/shared';
import { resetPassword } from '@/lib/api';
import { authErrorKey } from '@/lib/utils/api-error-message';
import { Link } from '@/i18n/navigation';
import { AuthCard } from '@/components/auth/auth-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function ResetPasswordPage(): React.ReactElement {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t('errorPasswordMismatch'));
      return;
    }
    const parsed = resetPasswordRequestSchema.safeParse({
      token,
      newPassword: password,
    });
    if (!parsed.success) {
      setError(t('resetPasswordError'));
      return;
    }

    setPending(true);
    try {
      await resetPassword(parsed.data);
      setSuccess(true);
    } catch (err) {
      setError(t(authErrorKey(err)));
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <AuthCard title={t('resetPasswordTitle')}>
        <p className="text-sm text-destructive">{t('resetPasswordError')}</p>
      </AuthCard>
    );
  }

  if (success) {
    return (
      <AuthCard title={t('resetPasswordTitle')}>
        <p className="text-sm text-foreground/90">
          {t('resetPasswordSuccess')}
        </p>
        <Button asChild className="w-full">
          <Link href="/login">{t('goToLogin')}</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('resetPasswordTitle')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">{t('newPasswordLabel')}</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">{t('confirmPasswordLabel')}</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={8}
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {t('resetPasswordCta')}
        </Button>
      </form>
    </AuthCard>
  );
}
