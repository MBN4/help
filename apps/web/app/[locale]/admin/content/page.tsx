'use client';

import * as React from 'react';
import Image from 'next/image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  approvePhoto,
  approveReview,
  listAdminPhotos,
  listAdminReviews,
  removePhoto,
  removeReview,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ReasonDialog } from '@/components/admin/reason-dialog';

interface ReviewRow {
  id: string;
  title: string | null;
  body: string | null;
  rating: number;
  status: string;
  user: { name: string };
  business: { name: string };
}

interface PhotoRow {
  id: string;
  url: string;
  status: string;
  user: { name: string };
  business: { name: string } | null;
}

export default function AdminContentPage(): React.ReactElement {
  const t = useTranslations('admin');
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState<'reviews' | 'photos'>('reviews');

  const reviewsQuery = useQuery({
    queryKey: ['admin', 'content', 'reviews'],
    queryFn: () =>
      listAdminReviews('PENDING') as unknown as Promise<ReviewRow[]>,
    enabled: tab === 'reviews',
  });
  const photosQuery = useQuery({
    queryKey: ['admin', 'content', 'photos'],
    queryFn: () => listAdminPhotos('PENDING') as unknown as Promise<PhotoRow[]>,
    enabled: tab === 'photos',
  });

  const [removingReviewId, setRemovingReviewId] = React.useState<string | null>(
    null,
  );
  const [removingPhotoId, setRemovingPhotoId] = React.useState<string | null>(
    null,
  );

  const approveReviewMutation = useMutation({
    mutationFn: approveReview,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['admin', 'content', 'reviews'],
      }),
  });
  const removeReviewMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      removeReview(id, { reason }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['admin', 'content', 'reviews'],
      }),
  });
  const approvePhotoMutation = useMutation({
    mutationFn: approvePhoto,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['admin', 'content', 'photos'],
      }),
  });
  const removePhotoMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      removePhoto(id, { reason }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['admin', 'content', 'photos'],
      }),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('content.title')}</h1>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={tab === 'reviews' ? 'default' : 'outline'}
          onClick={() => setTab('reviews')}
        >
          {t('content.reviewsTab')}
        </Button>
        <Button
          size="sm"
          variant={tab === 'photos' ? 'default' : 'outline'}
          onClick={() => setTab('photos')}
        >
          {t('content.photosTab')}
        </Button>
      </div>

      {tab === 'reviews' ? (
        reviewsQuery.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="space-y-3">
            {(reviewsQuery.data ?? []).length === 0 ? (
              <p className="text-muted-foreground">{t('content.empty')}</p>
            ) : (
              reviewsQuery.data?.map((review) => (
                <Card key={review.id}>
                  <CardContent className="space-y-2 py-4">
                    <p className="font-medium">
                      {review.business.name} — {review.rating}/5
                    </p>
                    <p className="text-sm text-muted-foreground">
                      by {review.user.name}
                    </p>
                    {review.title ? (
                      <p className="font-medium">{review.title}</p>
                    ) : null}
                    {review.body ? (
                      <p className="text-sm">{review.body}</p>
                    ) : null}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => approveReviewMutation.mutate(review.id)}
                      >
                        {t('content.approve')}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setRemovingReviewId(review.id)}
                      >
                        {t('content.remove')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )
      ) : photosQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(photosQuery.data ?? []).length === 0 ? (
            <p className="text-muted-foreground">{t('content.empty')}</p>
          ) : (
            photosQuery.data?.map((photo) => (
              <Card key={photo.id}>
                <CardContent className="space-y-2 py-4">
                  <div className="relative h-40 w-full overflow-hidden rounded-md bg-secondary">
                    <Image
                      src={photo.url}
                      alt={
                        photo.business?.name
                          ? t('content.photoAlt', {
                              user: photo.user.name,
                              business: photo.business.name,
                            })
                          : t('content.photoAltNoBusiness', {
                              user: photo.user.name,
                            })
                      }
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {photo.business?.name ?? '—'} · {photo.user.name}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => approvePhotoMutation.mutate(photo.id)}
                    >
                      {t('content.approve')}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setRemovingPhotoId(photo.id)}
                    >
                      {t('content.remove')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      <ReasonDialog
        open={removingReviewId !== null}
        onOpenChange={(open) => !open && setRemovingReviewId(null)}
        title={t('content.removeReviewTitle')}
        confirmLabel={t('content.remove')}
        onConfirm={async (reason) => {
          if (removingReviewId) {
            await removeReviewMutation.mutateAsync({
              id: removingReviewId,
              reason,
            });
          }
        }}
      />
      <ReasonDialog
        open={removingPhotoId !== null}
        onOpenChange={(open) => !open && setRemovingPhotoId(null)}
        title={t('content.removePhotoTitle')}
        confirmLabel={t('content.remove')}
        onConfirm={async (reason) => {
          if (removingPhotoId) {
            await removePhotoMutation.mutateAsync({
              id: removingPhotoId,
              reason,
            });
          }
        }}
      />
    </div>
  );
}
