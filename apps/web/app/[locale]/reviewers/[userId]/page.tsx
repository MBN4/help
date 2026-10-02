import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Image from 'next/image';
import { BadgeCheck, Camera, Star, ThumbsUp } from 'lucide-react';
import { ApiError, getPublicUserProfile } from '@/lib/api';
import { buildMetadata } from '@/lib/seo/metadata';
import { Link } from '@/i18n/navigation';
import { RatingBadge } from '@/components/business/rating-badge';
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

  const memberSince = new Date(profile.memberSince).toLocaleDateString(
    'en-GB',
    { year: 'numeric', month: 'short' },
  );
  const stats = [
    { icon: Star, text: t('reviewCount', { count: profile.reviewCount }) },
    { icon: Camera, text: t('photoCount', { count: profile.photoCount }) },
    {
      icon: ThumbsUp,
      text: t('helpfulVotesReceived', { count: profile.helpfulVotesReceived }),
    },
  ];

  return (
    <div className="container grid gap-8 py-8 md:grid-cols-[280px_1fr]">
      <aside className="space-y-5 md:sticky md:top-44 md:h-fit">
        <div className="flex items-center gap-4 md:flex-col md:items-start">
          {profile.avatarUrl ? (
            <Image
              src={profile.avatarUrl}
              alt=""
              width={112}
              height={112}
              className="h-20 w-20 shrink-0 rounded-full object-cover md:h-28 md:w-28"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand-100 font-display text-3xl font-bold text-brand-700 md:h-28 md:w-28 md:text-4xl"
            >
              {profile.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-bold">{profile.name}</h1>
            <p className="text-sm text-muted-foreground">
              {t('memberSince', { date: memberSince })}
            </p>
            {profile.isVerifiedReviewer && (
              <Badge variant="outline" className="gap-1">
                <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                {reviewT('verifiedReviewer')}
              </Badge>
            )}
          </div>
        </div>

        {profile.bio && (
          <p className="text-sm leading-relaxed text-foreground/90">
            {profile.bio}
          </p>
        )}

        <ul className="divide-y divide-border rounded border border-border bg-white">
          {stats.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex items-center gap-3 px-4 py-3 text-sm"
            >
              <Icon className="h-4 w-4 text-brand-600" aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>
      </aside>

      <section className="min-w-0 space-y-4">
        <h2 className="font-display text-2xl font-bold">
          {t('recentReviewsTitle')}
        </h2>
        {profile.recentReviews.length === 0 && (
          <p className="text-muted-foreground">{t('noReviews')}</p>
        )}
        <div className="space-y-4">
          {profile.recentReviews.map((review) => (
            <article
              key={review.id}
              className="space-y-2 rounded border border-border bg-white p-4"
            >
              <Link
                href={`/business/${review.businessSlug}`}
                className="font-display text-base font-bold hover:underline"
              >
                {review.businessName}
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <RatingBadge rating={review.rating} />
                <time
                  dateTime={review.createdAt}
                  className="text-sm text-muted-foreground"
                >
                  {new Date(review.createdAt).toLocaleDateString('en-GB', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </time>
              </div>
              {review.title && <p className="font-semibold">{review.title}</p>}
              {review.body && (
                <p className="text-sm leading-relaxed text-ink">
                  {review.body}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
