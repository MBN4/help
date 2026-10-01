'use client';

import { Home, MapPinned, Search, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { DEFAULT_CITY_SLUG } from '@/lib/constants';
import { cn } from '@/lib/utils/cn';
import { useSession } from '@/lib/hooks/use-session';

export function MobileNav(): React.ReactElement {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const { isAuthenticated } = useSession();

  const items = [
    { href: '/', label: t('home'), icon: Home, active: pathname === '/' },
    {
      href: '/search',
      label: t('search'),
      icon: Search,
      active: pathname.startsWith('/search'),
    },
    {
      href: `/${DEFAULT_CITY_SLUG}`,
      label: t('categories'),
      icon: MapPinned,
      active: pathname.startsWith(`/${DEFAULT_CITY_SLUG}`),
    },
    {
      href: isAuthenticated ? '/account' : '/login',
      label: isAuthenticated ? t('account') : t('login'),
      icon: User,
      active: pathname.startsWith('/account'),
    },
  ];

  return (
    <nav
      aria-label={t('menu')}
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-border bg-background sm:hidden"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium',
            item.active ? 'text-saffron-700' : 'text-muted-foreground',
          )}
        >
          <item.icon className="h-5 w-5" aria-hidden="true" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
