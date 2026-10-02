'use client';

import * as React from 'react';
import Image from 'next/image';
import { useFormatter, useTranslations } from 'next-intl';
import { ThumbsUp, User as UserIcon } from 'lucide-react';
import type { RecentActivityItem } from '@buisnez/shared';
import { Link } from '@/i18n/navigation';
import { RatingBadge } from './rating-badge';
import { Skeleton } from '@/components/ui/skeleton';

export interface ActivityCardProps {
  activity: RecentActivityItem;
}

const SNIPPET_LIMIT = 140;
const JUST_NOW_MS = 60_000;

/** Yelp-style link teal for "Read more". */
const linkClass = 'font-semibold text-[#056c8e] hover:underline';

/** Homepage "Recent Activity" feed card, laid out like Yelp's: avatar + "Name wrote a review" + relative
 * time, divider, photo, business name, score squares, review text. Backed by the read-only
 * `GET /discovery/recent-activity` endpoint (docs/PROGRESS.md's design-overhaul entry). */
export function ActivityCard({
  activity,
}: ActivityCardProps): React.ReactElement {
  const t = useTranslations('home');
  const format = useFormatter();
  const [expanded, setExpanded] = React.useState(false);
  const body = activity.body ?? '';
  const isLong = body.length > SNIPPET_LIMIT;
  const snippet =
    expanded || !isLong ? body : `${body.slice(0, SNIPPET_LIMIT).trimEnd()}…`;
  const createdAt = new Date(activity.createdAt);
  const href = `/business/${activity.business.slug}`;

  return (
    <article className="rounded border border-border bg-white p-4">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        {activity.userAvatarUrl ? (
          <Image
            src={activity.userAvatarUrl}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <UserIcon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">
            {t('activityWroteReview', { name: activity.userName })}
          </p>
          <time
            dateTime={activity.createdAt}
            suppressHydrationWarning
            className="text-xs text-muted-foreground"
          >
            {Date.now() - createdAt.getTime() < JUST_NOW_MS
              ? t('justNow')
              : format.relativeTime(createdAt)}
          </time>
        </div>
      </div>

      <Link
        href={href}
        className="-mx-4 mt-4 block"
        aria-label={activity.business.name}
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {activity.business.thumbnailUrl ? (
            <Image
              src={activity.business.thumbnailUrl}
              alt={activity.business.name}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="h-full w-full bg-brand-100" />
          )}
        </div>
      </Link>

      <div className="mt-4 flex flex-col gap-1.5">
        <Link
          href={href}
          className="font-display text-base font-bold text-ink hover:underline"
        >
          {activity.business.name}
        </Link>
        <RatingBadge rating={activity.rating} />

        {snippet && (
          <p className="text-sm leading-relaxed text-ink">
            {snippet}
            {isLong && !expanded && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className={`ms-1 ${linkClass}`}
              >
                {t('readMore')}
              </button>
            )}
          </p>
        )}

        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ThumbsUp className="h-4 w-4" aria-hidden="true" />
          <span>{t('helpfulCount', { count: activity.helpfulCount })}</span>
        </div>
      </div>
    </article>
  );
}

export function ActivityCardSkeleton(): React.ReactElement {
  return (
    <div className="rounded border border-border bg-white p-4">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-8 w-40" />
      </div>
      <Skeleton className="-mx-4 mt-4 aspect-[4/3] w-[calc(100%+2rem)] rounded-none" />
      <Skeleton className="mt-4 h-5 w-2/3" />
      <Skeleton className="mt-2 h-5 w-32" />
    </div>
  );
}
