'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type {
  BusinessManageProfile,
  BusinessPhoto,
  BusinessReview,
} from '@buisnez/shared';
import {
  ApiError,
  getBusinessPhotos,
  getBusinessReviews,
  getManageProfile,
  updateBusinessLocation,
} from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CoreInfoForm } from '@/components/business-owner/core-info-form';
import { HoursEditor } from '@/components/business-owner/hours-editor';
import { FeaturesEditor } from '@/components/business-owner/features-editor';
import { ServicesEditor } from '@/components/business-owner/services-editor';
import { PhotosEditor } from '@/components/business-owner/photos-editor';
import { ReviewsEditor } from '@/components/business-owner/reviews-editor';
import { LazyPinDropMap } from '@/components/business-owner/lazy-pin-drop-map';

const LAHORE_FALLBACK_CENTER = { lat: 31.5204, lng: 74.3587 };

function LocationEditor({
  business,
  onSaved,
}: {
  business: BusinessManageProfile;
  onSaved: (business: BusinessManageProfile) => void;
}): React.ReactElement {
  const t = useTranslations('businessOwner');
  const [coords, setCoords] = React.useState(
    business.location ?? LAHORE_FALLBACK_CENTER,
  );
  const [pending, setPending] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSave(): Promise<void> {
    setPending(true);
    setSaved(false);
    setError(null);
    try {
      const { data } = await updateBusinessLocation(business.id, coords);
      onSaved(data);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errorGeneric'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-xl space-y-3">
      <LazyPinDropMap value={coords} onChange={setCoords} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-success">{t('savedSuccess')}</p>}
      <Button type="button" disabled={pending} onClick={handleSave}>
        {t('saveChanges')}
      </Button>
    </div>
  );
}

export default function BusinessManagePage(): React.ReactElement {
  const t = useTranslations('businessOwner');
  const params = useParams<{ businessId: string }>();
  const businessId = params.businessId;

  const [business, setBusiness] = React.useState<BusinessManageProfile | null>(
    null,
  );
  const [photos, setPhotos] = React.useState<BusinessPhoto[]>([]);
  const [reviews, setReviews] = React.useState<BusinessReview[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      setLoading(true);
      setLoadError(null);
      try {
        const [manageResult, photosResult, reviewsResult] = await Promise.all([
          getManageProfile(businessId),
          getBusinessPhotos(businessId, 1, 50).catch(() => ({
            data: [] as BusinessPhoto[],
          })),
          getBusinessReviews(businessId, 1, 50).catch(() => ({
            data: [] as BusinessReview[],
          })),
        ]);
        if (cancelled) {
          return;
        }
        setBusiness(manageResult.data);
        setPhotos(photosResult.data);
        setReviews(reviewsResult.data);
      } catch (err) {
        if (cancelled) {
          return;
        }
        if (err instanceof ApiError) {
          setLoadError(err.message);
        } else {
          setLoadError(t('errorGeneric'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [businessId, t]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (loadError || !business) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-destructive">
        {loadError ?? t('errorGeneric')}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold">{business.name}</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('sections.info')}</h2>
        <CoreInfoForm business={business} onSaved={setBusiness} />
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('sections.hours')}</h2>
        <HoursEditor business={business} onSaved={setBusiness} />
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('sections.features')}</h2>
        <FeaturesEditor business={business} onSaved={setBusiness} />
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('sections.services')}</h2>
        <ServicesEditor
          businessId={business.id}
          services={business.services}
          onChange={(services) =>
            setBusiness((current) =>
              current ? { ...current, services } : current,
            )
          }
        />
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('sections.photos')}</h2>
        <PhotosEditor
          businessId={business.id}
          value={photos}
          onChange={setPhotos}
        />
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('sections.location')}</h2>
        <LocationEditor business={business} onSaved={setBusiness} />
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('sections.reviews')}</h2>
        <ReviewsEditor
          businessId={business.id}
          reviews={reviews}
          onChange={setReviews}
        />
      </section>
    </div>
  );
}
