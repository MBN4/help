import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { RatingBadge } from '@/components/business/rating-badge';

/** Decorative right-hand panel (hidden below `lg`), like Yelp's auth screens: brand colour + a sample review. */
function AuthShowcase(): React.ReactElement {
  const t = useTranslations('auth');

  return (
    <aside
      aria-hidden="true"
      className="relative hidden overflow-hidden bg-gradient-to-br from-brand-900 via-brand-700 to-brand-600 text-white lg:flex lg:items-center lg:justify-center"
    >
      <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]" />
      <div className="relative max-w-md space-y-8 px-10">
        <div className="space-y-3">
          <p className="font-display text-4xl font-extrabold leading-tight text-balance">
            {t('showcaseTitle')}
          </p>
          <p className="text-lg text-white/85">{t('showcaseBody')}</p>
        </div>
        <div className="space-y-3 rounded-xl bg-white p-5 text-ink shadow-xl">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">
              B
            </span>
            <div>
              <p className="text-sm font-semibold">{t('showcaseReviewer')}</p>
              <p className="text-xs text-muted-foreground">
                {t('showcaseTime')}
              </p>
            </div>
          </div>
          <RatingBadge rating={5} />
          <p className="text-sm leading-relaxed">{t('showcaseReview')}</p>
        </div>
      </div>
    </aside>
  );
}

export function AuthCard({
  title,
  subtitle,
  backHref,
  backLabel,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Optional "back" link shown above the title (e.g. forgot-password → login). */
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="grid min-h-[calc(100vh-8rem)] lg:grid-cols-2">
      <div className="flex justify-center px-4 py-10 sm:py-14 lg:py-20">
        <div className="w-full max-w-md space-y-6">
          {backHref && backLabel && (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft
                className="h-4 w-4 rtl:rotate-180"
                aria-hidden="true"
              />
              {backLabel}
            </Link>
          )}
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
              {title}
            </h1>
            {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="space-y-5">{children}</div>
        </div>
      </div>
      <AuthShowcase />
    </div>
  );
}
