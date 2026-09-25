'use client';

import * as React from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { UploadedPhoto } from '@buisnez/shared';
import {
  ApiError,
  addBusinessPhoto,
  deleteBusinessPhoto,
  presignPhotoUpload,
} from '@/lib/api';

const MAX_PHOTOS = 20;
const ACCEPTED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export function PhotosEditor({
  businessId,
  value,
  onChange,
}: {
  businessId: string;
  value: UploadedPhoto[];
  onChange: (photos: UploadedPhoto[]) => void;
}): React.ReactElement {
  const t = useTranslations('businessOwner');
  const reviewT = useTranslations('review');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    if (
      !ACCEPTED_CONTENT_TYPES.includes(
        file.type as (typeof ACCEPTED_CONTENT_TYPES)[number],
      )
    ) {
      setError(reviewT('uploadFailed'));
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const { data: presign } = await presignPhotoUpload({
        contentType: file.type as (typeof ACCEPTED_CONTENT_TYPES)[number],
      });
      const uploadResponse = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      });
      if (!uploadResponse.ok) {
        throw new Error('Direct upload to storage failed');
      }
      const { data: photo } = await addBusinessPhoto(businessId, {
        key: presign.key,
      });
      onChange([...value, photo]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : reviewT('uploadFailed'));
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(id: string): Promise<void> {
    setError(null);
    setPendingId(id);
    try {
      await deleteBusinessPhoto(businessId, id);
      onChange(value.filter((photo) => photo.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errorGeneric'));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((photo) => (
          <div
            key={photo.id}
            className="relative h-24 w-24 overflow-hidden rounded-md border border-border"
          >
            <Image
              src={photo.thumbUrl ?? photo.url}
              alt={photo.caption ?? ''}
              fill
              sizes="96px"
              className="object-cover"
            />
            <button
              type="button"
              onClick={() => removePhoto(photo.id)}
              disabled={pendingId === photo.id}
              className="absolute end-1 top-1 rounded-full bg-background/80 p-0.5"
              aria-label={t('photos.remove')}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {value.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {uploading ? reviewT('uploading') : reviewT('addPhoto')}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
