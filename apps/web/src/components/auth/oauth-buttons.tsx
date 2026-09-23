import { useTranslations } from 'next-intl';
import { API_BASE_URL } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export function OAuthButtons(): React.ReactElement {
  const t = useTranslations('auth');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {t('orContinueWith')}
        </span>
        <Separator className="flex-1" />
      </div>
      <Button asChild variant="outline" className="w-full">
        <a href={`${API_BASE_URL}/auth/google`}>{t('continueWithGoogle')}</a>
      </Button>
      <Button asChild variant="outline" className="w-full">
        <a href={`${API_BASE_URL}/auth/facebook`}>
          {t('continueWithFacebook')}
        </a>
      </Button>
    </div>
  );
}
