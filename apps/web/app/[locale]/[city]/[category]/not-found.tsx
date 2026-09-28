import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

export default async function CityCategoryNotFound(): Promise<React.ReactElement> {
  const t = await getTranslations('errors');

  return (
    <div className="container flex flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-2xl font-bold">{t('categoryNotFoundTitle')}</h1>
      <p className="max-w-md text-muted-foreground">
        {t('categoryNotFoundDescription')}
      </p>
      <Button asChild variant="outline">
        <Link href="/">{t('backHome')}</Link>
      </Button>
    </div>
  );
}
