import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export function Footer(): React.ReactElement {
  const t = useTranslations('footer');
  const year = new Date().getFullYear();

  return (
    <footer className="mt-12 border-t border-border pb-20 pt-8 sm:pb-8">
      <div className="container flex flex-col gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p className="font-semibold text-foreground">Buisnez</p>
        <nav className="flex flex-wrap gap-4">
          <Link href="/" className="hover:text-foreground hover:underline">
            {t('about')}
          </Link>
          <Link href="/" className="hover:text-foreground hover:underline">
            {t('forBusinesses')}
          </Link>
          <Link href="/" className="hover:text-foreground hover:underline">
            {t('help')}
          </Link>
        </nav>
        <p>{t('copyright', { year })}</p>
      </div>
    </footer>
  );
}
