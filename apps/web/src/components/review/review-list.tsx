'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { BusinessReview } from '@buisnez/shared';
import { getMyHelpfulVotes, toggleHelpful } from '@/lib/api';
import { useSession } from '@/lib/hooks/use-session';
import { ReviewCard } from './review-card';

export function ReviewList({
  businessId,
  reviews,
}: {
  businessId: string;
  reviews: BusinessReview[];
}): React.ReactElement {
  const { isAuthenticated } = useSession();
  const votesQuery = useQuery({
    queryKey: ['my-helpful-votes', businessId],
    queryFn: async () => new Set((await getMyHelpfulVotes(businessId)).data),
    enabled: isAuthenticated,
  });

  const [localReviews, setLocalReviews] = React.useState(reviews);
  const [votedIds, setVotedIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (votesQuery.data) {
      setVotedIds(votesQuery.data);
    }
  }, [votesQuery.data]);

  async function handleToggle(reviewId: string): Promise<void> {
    const wasVoted = votedIds.has(reviewId);
    setVotedIds((current) => {
      const next = new Set(current);
      if (wasVoted) {
        next.delete(reviewId);
      } else {
        next.add(reviewId);
      }
      return next;
    });
    setLocalReviews((current) =>
      current.map((review) =>
        review.id === reviewId
          ? {
              ...review,
              helpfulCount: review.helpfulCount + (wasVoted ? -1 : 1),
            }
          : review,
      ),
    );
    try {
      await toggleHelpful(reviewId);
    } catch {
      // revert on failure
      setVotedIds((current) => {
        const next = new Set(current);
        if (wasVoted) {
          next.add(reviewId);
        } else {
          next.delete(reviewId);
        }
        return next;
      });
      setLocalReviews((current) =>
        current.map((review) =>
          review.id === reviewId
            ? {
                ...review,
                helpfulCount: review.helpfulCount + (wasVoted ? 1 : -1),
              }
            : review,
        ),
      );
    }
  }

  return (
    <div>
      {localReviews.map((review) => (
        <ReviewCard
          key={review.id}
          review={review}
          isHelpfulByMe={votedIds.has(review.id)}
          onToggleHelpful={
            isAuthenticated ? () => handleToggle(review.id) : undefined
          }
        />
      ))}
    </div>
  );
}
