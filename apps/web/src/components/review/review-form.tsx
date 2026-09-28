'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  createReviewRequestSchema,
  type BusinessProfile,
  type BusinessReview,
  type UploadedPhoto,
} from '@buisnez/shared';
import { createOrUpdateReview } from '@/lib/api';
import { authErrorKey } from '@/lib/utils/api-error-message';
import { trackEvent } from '@/lib/analytics/posthog';
import {
  subRatingDimensionsForCategory,
  subRatingLabelKey,
} from '@/lib/utils/sub-rating-dimensions';
import { StarRatingInput } from '@/components/business/star-rating-input';
import { PhotoAttachments } from './photo-attachments';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export function ReviewForm({
  business,
  existingReview,
  onSaved,
}: {
  business: BusinessProfile;
  existingReview?: BusinessReview;
  onSaved: (review: BusinessReview) => void;
}): React.ReactElement {
  const t = useTranslations('review');
  const authT = useTranslations('auth');

  const dimensions = subRatingDimensionsForCategory(
    business.category.parent?.slug ?? business.category.slug,
  );

  const [rating, setRating] = React.useState(existingReview?.rating ?? 0);
  const [subRatings, setSubRatings] = React.useState<Record<string, number>>(
    existingReview?.subRatings ?? {},
  );
  const [title, setTitle] = React.useState(existingReview?.title ?? '');
  const [body, setBody] = React.useState(existingReview?.body ?? '');
  const [photos, setPhotos] = React.useState<UploadedPhoto[]>([]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);

    const parsed = createReviewRequestSchema.safeParse({
      rating,
      subRatings: Object.keys(subRatings).length > 0 ? subRatings : undefined,
      title: title.trim() || undefined,
      body: body.trim() || undefined,
      photoIds: photos.length > 0 ? photos.map((photo) => photo.id) : undefined,
    });
    if (!parsed.success) {
      setError(authT('errorGeneric'));
      return;
    }

    setPending(true);
    try {
      const { data } = await createOrUpdateReview(business.id, parsed.data);
      trackEvent('review submitted', {
        businessId: business.id,
        rating,
        isUpdate: Boolean(existingReview),
      });
      onSaved(data);
    } catch (err) {
      setError(authT(authErrorKey(err)));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-border p-4"
    >
      <h3 className="font-semibold">
        {existingReview ? t('editReview') : t('writeReview')}
      </h3>

      <div className="space-y-1.5">
        <Label>{t('yourRating')}</Label>
        <StarRatingInput value={rating} onChange={setRating} />
      </div>

      {dimensions.map((dimension) => (
        <div key={dimension} className="flex items-center justify-between">
          <Label>{t(subRatingLabelKey(dimension))}</Label>
          <StarRatingInput
            size="sm"
            value={subRatings[dimension] ?? 0}
            onChange={(value) =>
              setSubRatings((current) => ({ ...current, [dimension]: value }))
            }
          />
        </div>
      ))}

      <div className="space-y-1.5">
        <Label htmlFor="review-title">{t('titleLabel')}</Label>
        <Input
          id="review-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t('titlePlaceholder')}
          maxLength={150}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="review-body">{t('bodyLabel')}</Label>
        <Textarea
          id="review-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={t('bodyPlaceholder')}
          maxLength={5000}
        />
      </div>

      <div className="space-y-1.5">
        <Label>{t('photosLabel')}</Label>
        <PhotoAttachments
          businessId={business.id}
          value={photos}
          onChange={setPhotos}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={pending || rating === 0}>
        {existingReview ? t('update') : t('submit')}
      </Button>
    </form>
  );
}
