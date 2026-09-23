'use client';

import * as React from 'react';
import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toggleFavorite } from '@/lib/api';
import { useSession } from '@/lib/hooks/use-session';
import { Link, usePathname } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

export function FavoriteButton({
  businessId,
  initialFavorited = false,
  variant = 'icon',
}: {
  businessId: string;
  initialFavorited?: boolean;
  variant?: 'icon' | 'full';
}): React.ReactElement {
  const t = useTranslations('favorites');
  const pathname = usePathname();
  const { isAuthenticated } = useSession();
  const [favorited, setFavorited] = React.useState(initialFavorited);
  const [pending, setPending] = React.useState(false);

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
        className={cn('h-4 w-4', favorited && 'fill-current')}
        aria-hidden="true"
      />
      {variant === 'full' && (favorited ? t('saved') : t('save'))}
    </Button>
  );
}
