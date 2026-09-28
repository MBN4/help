import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BadgeCheck } from 'lucide-react';
import { ApiError, getPublicUserProfile } from '@/lib/api';
import { buildMetadata } from '@/lib/seo/metadata';
import { Link } from '@/i18n/navigation';
import { RatingStars } from '@/components/business/rating-stars';
import { Badge } from '@/components/ui/badge';

export const revalidate = 600;

interface PageProps {
  params: Promise<{ locale: string; userId: string }>;
}

async function loadProfile(userId: string) {
  try {
    return await getPublicUserProfile(userId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, userId } = await params;
  const { data: profile } = await loadProfile(userId);
  return buildMetadata({
    title: `${profile.name} — Buisnez`,
    description: `${profile.name}'s reviews and contributions on Buisnez.`,
    path: `/reviewers/${userId}`,
    locale,
  });
}

export default async function ReviewerProfilePage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { locale, userId } = await params;
  setRequestLocale(locale);

  const [t, reviewT, { data: profile }] = await Promise.all([
    getTranslations('reviewerProfile'),
    getTranslations('review'),
    loadProfile(userId),
  ]);

  return (
    <div className="container max-w-2xl space-y-6 py-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{profile.name}</h1>
          {profile.isVerifiedReviewer && (
            <Badge variant="outline" className="gap-1">
              <BadgeCheck className="h-3 w-3" aria-hidden="true" />
              {reviewT('verifiedReviewer')}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {t('memberSince', {
            date: new Date(profile.memberSince).toLocaleDateString('en-GB', {
              year: 'numeric',
              month: 'short',
            }),
          })}
        </p>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>{t('reviewCount', { count: profile.reviewCount })}</span>
          <span>{t('photoCount', { count: profile.photoCount })}</span>
          <span>
            {t('helpfulVotesReceived', {
              count: profile.helpfulVotesReceived,
            })}
          </span>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('recentReviewsTitle')}</h2>
        {profile.recentReviews.length === 0 && (
          <p className="text-muted-foreground">{t('noReviews')}</p>
        )}
        <div className="space-y-4">
          {profile.recentReviews.map((review) => (
            <article
              key={review.id}
              className="space-y-1.5 border-b border-border pb-4"
            >
              <Link
                href={`/business/${review.businessSlug}`}
                className="font-semibold hover:underline"
              >
                {review.businessName}
              </Link>
              <div className="flex items-center gap-2">
                <RatingStars rating={review.rating} />
                <time
                  dateTime={review.createdAt}
                  className="text-xs text-muted-foreground"
                >
                  {new Date(review.createdAt).toLocaleDateString('en-GB', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </time>
              </div>
              {review.title && <p className="font-medium">{review.title}</p>}
              {review.body && (
                <p className="text-sm text-foreground/90">{review.body}</p>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
