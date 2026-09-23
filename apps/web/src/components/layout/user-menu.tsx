'use client';

import { useTranslations } from 'next-intl';
import { User } from 'lucide-react';
import { logout } from '@/lib/api';
import { useSession, useInvalidateSession } from '@/lib/hooks/use-session';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function UserMenu(): React.ReactElement {
  const t = useTranslations('nav');
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useSession();
  const invalidateSession = useInvalidateSession();

  async function handleLogout(): Promise<void> {
    await logout().catch(() => undefined);
    await invalidateSession();
    router.push('/');
  }

  if (isLoading) {
    return <Skeleton className="h-9 w-20" />;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-3 text-sm font-medium">
        <Link href="/login" className="hover:text-primary">
          {t('login')}
        </Link>
        <Button asChild size="sm">
          <Link href="/register">{t('signup')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm font-medium">
      <Link
        href="/account"
        className="flex items-center gap-1.5 hover:text-primary"
      >
        <User className="h-4 w-4" aria-hidden="true" />
        {user?.name}
      </Link>
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        {t('logout')}
      </Button>
    </div>
  );
}
