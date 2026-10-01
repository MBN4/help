'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { forgotPasswordRequestSchema } from '@buisnez/shared';
import { forgotPassword } from '@/lib/api';
import { Link } from '@/i18n/navigation';
import { AuthCard } from '@/components/auth/auth-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function ForgotPasswordPage(): React.ReactElement {
  const t = useTranslations('auth');
  const [email, setEmail] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const parsed = forgotPasswordRequestSchema.safeParse({ email });
    if (!parsed.success) {
      return;
    }
    setPending(true);
    try {
      await forgotPassword(parsed.data);
    } finally {
      // Always shows the same success state — no account enumeration (mirrors the API's behavior).
      setPending(false);
      setSent(true);
    }
  }

  if (sent) {
    return (
      <AuthCard
        backHref="/login"
        backLabel={t('backToLogin')}
        title={t('forgotPasswordTitle')}
      >
        <p className="text-sm text-foreground/90">{t('forgotPasswordSent')}</p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">{t('goToLogin')}</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      backHref="/login"
      backLabel={t('backToLogin')}
      title={t('forgotPasswordTitle')}
      subtitle={t('forgotPasswordSubtitle')}
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
        <Button type="submit" className="w-full" disabled={pending}>
          {t('forgotPasswordCta')}
        </Button>
      </form>
    </AuthCard>
  );
}
