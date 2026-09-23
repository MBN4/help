'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { API_BASE_URL } from '@/lib/api';
import { AuthCard } from '@/components/auth/auth-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function OAuthStubPage(): React.ReactElement {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const provider =
    searchParams.get('provider') === 'facebook' ? 'facebook' : 'google';
  const providerLabel = provider === 'facebook' ? 'Facebook' : 'Google';

  return (
    <AuthCard
      title={t('oauthStubTitle', { provider: providerLabel })}
      subtitle={t('oauthStubSubtitle', { provider: providerLabel })}
    >
      <form
        action={`${API_BASE_URL}/auth/oauth-stub/${provider}/callback`}
        method="GET"
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="name">{t('nameLabel')}</Label>
          <Input
            id="name"
            name="name"
            placeholder={t('namePlaceholder')}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t('emailLabel')}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder={t('emailPlaceholder')}
            required
          />
        </div>
        <Button type="submit" className="w-full">
          {t('oauthStubCta')}
        </Button>
      </form>
    </AuthCard>
  );
}
