import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

export interface ImageVariants {
  thumb: Buffer;
  card: Buffer;
  full: Buffer;
}

const VARIANT_SIZES = {
  thumb: { width: 200, height: 200 },
  card: { width: 640 },
  full: { width: 1600 },
} as const;

@Injectable()
export class ImageProcessingService {
  /**
   * Produces thumb/card/full JPEG variants. `.rotate()` bakes in the EXIF orientation before sharp's
   * default (metadata-stripping) output drops the EXIF block entirely, so orientation is preserved but no
   * other metadata (GPS, camera info, etc.) survives.
   */
  async processVariants(original: Buffer): Promise<ImageVariants> {
    const base = sharp(original).rotate();

    const [thumb, card, full] = await Promise.all([
      base
        .clone()
        .resize({ ...VARIANT_SIZES.thumb, fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer(),
      base
        .clone()
        .resize({ ...VARIANT_SIZES.card, withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer(),
      base
        .clone()
        .resize({ ...VARIANT_SIZES.full, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer(),
    ]);

    return { thumb, card, full };
  }
}
