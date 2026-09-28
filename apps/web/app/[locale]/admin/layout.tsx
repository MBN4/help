'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from '@/lib/hooks/use-session';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils/cn';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * CSR role gate — a UX nicety only. The real authorization boundary is `RolesGuard` server-side on every
 * `/admin/*` route (see docs/10-auth-roles.md). MODERATOR/ADMIN both pass this gate; individual pages/
 * controls further hide ADMIN-only actions from a MODERATOR.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const t = useTranslations('admin');
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, isAuthenticated, user } = useSession();

  const isModeratorOrAdmin =
    user?.role === 'MODERATOR' || user?.role === 'ADMIN';
  const isAdmin = user?.role === 'ADMIN';

  React.useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !isModeratorOrAdmin) {
      router.replace('/');
      return;
    }
    // Defense in depth: a MODERATOR navigating directly to an ADMIN-only route gets redirected too, even
    // though the server-side RolesGuard would already 403 the underlying API calls.
    const adminOnlyPrefixes = ['/admin/users', '/admin/taxonomy'];
    if (!isAdmin && adminOnlyPrefixes.some((p) => pathname.startsWith(p))) {
      router.replace('/admin');
    }
  }, [
    isLoading,
    isAuthenticated,
    isModeratorOrAdmin,
    isAdmin,
    pathname,
    router,
  ]);

  if (isLoading || !isAuthenticated || !isModeratorOrAdmin) {
    return (
      <div className="container space-y-4 py-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const navItems = [
    { href: '/admin', label: t('nav.dashboard') },
    { href: '/admin/claims', label: t('nav.claims') },
    { href: '/admin/reports', label: t('nav.reports') },
    { href: '/admin/content', label: t('nav.content') },
    { href: '/admin/businesses', label: t('nav.businesses') },
    { href: '/admin/edit-suggestions', label: t('nav.editSuggestions') },
    ...(isAdmin
      ? [
          { href: '/admin/users', label: t('nav.users') },
          { href: '/admin/taxonomy', label: t('nav.taxonomy') },
        ]
      : []),
    { href: '/admin/moderation-log', label: t('nav.moderationLog') },
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
                ? 'bg-secondary text-primary'
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
