'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from '@/lib/hooks/use-session';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils/cn';
import { Skeleton } from '@/components/ui/skeleton';

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const t = useTranslations('account');
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, isAuthenticated } = useSession();

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="container space-y-4 py-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const navItems = [
    { href: '/account', label: t('nav.profile') },
    { href: '/account/reviews', label: t('nav.reviews') },
    { href: '/account/photos', label: t('nav.photos') },
    { href: '/account/favorites', label: t('nav.favorites') },
    { href: '/account/businesses', label: t('nav.businesses') },
  ];

  return (
    <div className="container grid gap-8 py-8 lg:grid-cols-[200px_1fr]">
      <aside className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'shrink-0 rounded-md px-3 py-2 text-sm font-medium',
              pathname === item.href
                ? 'bg-secondary text-saffron-700'
                : 'text-muted-foreground hover:bg-secondary',
            )}
          >
            {item.label}
          </Link>
        ))}
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
