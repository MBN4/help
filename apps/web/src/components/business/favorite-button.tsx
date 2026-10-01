'use client';

import * as React from 'react';
import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toggleFavorite } from '@/lib/api';
import { useSession } from '@/lib/hooks/use-session';
import {
  useFavoriteIds,
  useInvalidateFavoriteIds,
} from '@/lib/hooks/use-favorites';
import { Link, usePathname } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

export function FavoriteButton({
  businessId,
  variant = 'icon',
}: {
  businessId: string;
  variant?: 'icon' | 'full';
}): React.ReactElement {
  const t = useTranslations('favorites');
  const pathname = usePathname();
  const { isAuthenticated } = useSession();
  // The business detail/card pages are server-rendered (ISR) with no per-user data, so the real saved
  // state has to be hydrated client-side from GET /favorites/mine/ids rather than passed in as a prop.
  const { favoriteIds } = useFavoriteIds();
  const invalidateFavoriteIds = useInvalidateFavoriteIds();
  const [favorited, setFavorited] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    setFavorited(favoriteIds.has(businessId));
  }, [favoriteIds, businessId]);

  if (!isAuthenticated) {
    return (
      <Button
        asChild
        variant="outline"
        size={variant === 'icon' ? 'icon' : 'sm'}
      >
        <Link
          href={`/login?returnTo=${encodeURIComponent(pathname)}`}
          title={t('loginRequired')}
          aria-label={t('loginRequired')}
          onClick={(event) => event.stopPropagation()}
        >
          <Heart className="h-4 w-4" aria-hidden="true" />
          {variant === 'full' && t('save')}
        </Link>
      </Button>
    );
  }

  async function handleClick(event: React.MouseEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    if (pending) {
      return;
    }
    const next = !favorited;
    setFavorited(next);
    setPending(true);
    try {
      await toggleFavorite(businessId);
      await invalidateFavoriteIds();
    } catch {
      setFavorited(!next);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant={favorited ? 'default' : 'outline'}
      size={variant === 'icon' ? 'icon' : 'sm'}
      onClick={handleClick}
      aria-pressed={favorited}
      aria-label={favorited ? t('saved') : t('save')}
    >
      <Heart
        className={cn(
          'h-4 w-4 transition-transform duration-150',
          favorited && 'animate-pop fill-current motion-reduce:animate-none',
        )}
        aria-hidden="true"
      />
      {variant === 'full' && (favorited ? t('saved') : t('save'))}
    </Button>
  );
}
