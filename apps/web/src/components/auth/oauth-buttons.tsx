import { useTranslations } from 'next-intl';
import { API_BASE_URL } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

/** Social sign-in buttons — shown above the email form, Yelp-style. */
export function OAuthButtons(): React.ReactElement {
  const t = useTranslations('auth');

  return (
    <div className="space-y-3">
      <Button asChild variant="outline" size="lg" className="w-full">
        <a href={`${API_BASE_URL}/auth/google`}>{t('continueWithGoogle')}</a>
      </Button>
      <Button asChild variant="outline" size="lg" className="w-full">
        <a href={`${API_BASE_URL}/auth/facebook`}>
          {t('continueWithFacebook')}
        </a>
      </Button>
    </div>
  );
}

export function OrDivider(): React.ReactElement {
  const t = useTranslations('auth');

  return (
    <div className="flex items-center gap-3" role="separator">
      <Separator className="flex-1" />
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('or')}
      </span>
      <Separator className="flex-1" />
    </div>
  );
}
