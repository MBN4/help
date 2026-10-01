'use client';

import * as React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ThumbsUp, User as UserIcon } from 'lucide-react';
import type { RecentActivityItem } from '@buisnez/shared';
import { Link } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { RatingStars } from './rating-stars';
import { Skeleton } from '@/components/ui/skeleton';

export interface ActivityCardProps {
  activity: RecentActivityItem;
}

const SNIPPET_LIMIT = 140;

/** Homepage "Recent Activity" feed card — docs/17-design-overhaul.md section 3. Backed by the new
 * read-only `GET /discovery/recent-activity` endpoint (docs/PROGRESS.md's design-overhaul entry). */
export function ActivityCard({
  activity,
}: ActivityCardProps): React.ReactElement {
  const t = useTranslations('home');
  const [expanded, setExpanded] = React.useState(false);
  const body = activity.body ?? '';
  const isLong = body.length > SNIPPET_LIMIT;
  const snippet =
    expanded || !isLong ? body : `${body.slice(0, SNIPPET_LIMIT).trimEnd()}…`;

  return (
    <Card className="card-hover overflow-hidden">
      <Link
        href={`/business/${activity.business.slug}`}
        className="block"
        aria-label={activity.business.name}
      >
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          {activity.business.thumbnailUrl ? (
            <Image
              src={activity.business.thumbnailUrl}
              alt={activity.business.name}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="card-hover-image object-cover"
            />
          ) : (
            <div className="h-full w-full bg-emerald-100" />
          )}
        </div>
      </Link>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          {activity.userAvatarUrl ? (
            <Image
              src={activity.userAvatarUrl}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-saffron-100 text-saffron-700">
              <UserIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          )}
          <span className="truncate text-sm font-medium text-ink">
            {activity.userName}
          </span>
          <time
            dateTime={activity.createdAt}
            className="ms-auto shrink-0 text-xs text-muted-foreground"
          >
            {new Date(activity.createdAt).toLocaleDateString('en-GB', {
              month: 'short',
              day: 'numeric',
            })}
          </time>
        </div>

        <Link
          href={`/business/${activity.business.slug}`}
          className="font-display text-sm font-bold hover:underline"
        >
          {activity.business.name}
        </Link>

        <div className="flex items-center gap-1.5 text-sm">
          <RatingStars rating={activity.rating} />
          <span className="font-medium text-ink">{activity.rating}.0</span>
        </div>

        {snippet && (
          <p className="text-sm text-muted-foreground">
            {snippet}
            {isLong && !expanded && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="ms-1 font-medium text-saffron-700 hover:underline"
              >
                {t('readMore')}
              </button>
            )}
          </p>
        )}

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t('helpfulCount', { count: activity.helpfulCount })}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function ActivityCardSkeleton(): React.ReactElement {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-video w-full rounded-none" />
      <CardContent className="flex flex-col gap-2 p-4">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}
