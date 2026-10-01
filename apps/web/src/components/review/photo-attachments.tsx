'use client';

import * as React from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { UploadedPhoto } from '@buisnez/shared';
import { usePhotoUpload } from '@/lib/hooks/use-photo-upload';
import { Button } from '@/components/ui/button';

const MAX_PHOTOS = 10;

export function PhotoAttachments({
  businessId,
  value,
  onChange,
}: {
  businessId: string;
  value: UploadedPhoto[];
  onChange: (photos: UploadedPhoto[]) => void;
}): React.ReactElement {
  const t = useTranslations('review');
  const { stage, upload } = usePhotoUpload();
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    try {
      const photo = await upload(file, { businessId });
      onChange([...value, photo]);
    } catch {
      // stage already reflects the error; nothing else to do here.
    }
  }

  function removePhoto(id: string): void {
    onChange(value.filter((photo) => photo.id !== id));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((photo) => (
          <div
            key={photo.id}
            className="relative h-20 w-20 overflow-hidden rounded-md border border-border"
          >
            <Image
              src={photo.thumbUrl ?? photo.url}
              alt=""
              fill
              sizes="80px"
              className="object-cover"
            />
            <button
              type="button"
              onClick={() => removePhoto(photo.id)}
              className="absolute end-1 top-1 rounded-full bg-background/80 p-0.5"
              aria-label={t('removePhoto')}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {value.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={stage === 'uploading' || stage === 'processing'}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-saffron-700 disabled:opacity-50"
          >
            {stage === 'uploading' || stage === 'processing'
              ? t('uploading')
              : t('addPhoto')}
          </button>
        )}
      </div>
      {stage === 'error' && (
        <p className="text-xs text-destructive">{t('uploadFailed')}</p>
      )}
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

export function AvatarUploadButton({
  onUploaded,
}: {
  onUploaded: (photo: UploadedPhoto) => void;
}): React.ReactElement {
  const { stage, upload } = usePhotoUpload();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const t = useTranslations('review');

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    try {
      const photo = await upload(file);
      onUploaded(photo);
    } catch {
      // stage reflects the error state already.
    }
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={stage === 'uploading' || stage === 'processing'}
      >
        {stage === 'uploading' || stage === 'processing'
          ? t('uploading')
          : t('addPhoto')}
      </Button>
      {stage === 'error' && (
        <p className="text-xs text-destructive">{t('uploadFailed')}</p>
      )}
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
