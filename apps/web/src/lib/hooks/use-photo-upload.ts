'use client';

import * as React from 'react';
import type { UploadedPhoto } from '@buisnez/shared';
import { confirmPhotoUpload, presignPhotoUpload } from '@/lib/api';

export type PhotoUploadStage = 'idle' | 'uploading' | 'processing' | 'error';

const ACCEPTED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export function usePhotoUpload(): {
  stage: PhotoUploadStage;
  upload: (
    file: File,
    options?: { businessId?: string; reviewId?: string; caption?: string },
  ) => Promise<UploadedPhoto>;
} {
  const [stage, setStage] = React.useState<PhotoUploadStage>('idle');

  async function upload(
    file: File,
    options: { businessId?: string; reviewId?: string; caption?: string } = {},
  ): Promise<UploadedPhoto> {
    if (
      !ACCEPTED_CONTENT_TYPES.includes(
        file.type as (typeof ACCEPTED_CONTENT_TYPES)[number],
      )
    ) {
      setStage('error');
      throw new Error('Unsupported image type');
    }

    setStage('uploading');
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

      setStage('processing');
      const { data: photo } = await confirmPhotoUpload({
        key: presign.key,
        businessId: options.businessId,
        reviewId: options.reviewId,
        caption: options.caption,
      });

      setStage('idle');
      return photo;
    } catch (error) {
      setStage('error');
      throw error;
    }
  }

  return { stage, upload };
}
