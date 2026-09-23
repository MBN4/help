import { Injectable } from '@nestjs/common';
import type {
  ConfirmPhotoRequest,
  PresignPhotoRequest,
  PresignPhotoResponse,
  UploadedPhoto,
} from '@buisnez/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { StorageService } from '../../integrations/storage/storage.service';
import { ImageProcessingService } from '../../integrations/storage/image-processing.service';

@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly imageProcessing: ImageProcessingService,
  ) {}

  async presign(input: PresignPhotoRequest): Promise<PresignPhotoResponse> {
    const key = this.storage.generateUploadKey(input.contentType);
    const uploadUrl = await this.storage.presignUpload(key, input.contentType);
    return { uploadUrl, key };
  }

  async confirm(
    userId: string,
    input: ConfirmPhotoRequest,
  ): Promise<UploadedPhoto> {
    if (input.businessId) {
      const business = await this.prisma.business.findFirst({
        where: { id: input.businessId, status: 'PUBLISHED' },
        select: { id: true },
      });
      if (!business) {
        throw new AppException(404, 'NOT_FOUND', 'Business not found');
      }
    }
    if (input.reviewId) {
      const review = await this.prisma.review.findFirst({
        where: { id: input.reviewId, userId },
        select: { id: true },
      });
      if (!review) {
        throw new AppException(404, 'NOT_FOUND', 'Review not found');
      }
    }

    const original = await this.storage.getObject(input.key);
    const variants = await this.imageProcessing.processVariants(original);

    const baseKey = input.key
      .replace(/^uploads\/originals\//, '')
      .replace(/\.[a-zA-Z0-9]+$/, '');

    const [url, cardUrl, thumbUrl] = await Promise.all([
      this.storage.putObject(
        `uploads/full/${baseKey}.jpg`,
        variants.full,
        'image/jpeg',
      ),
      this.storage.putObject(
        `uploads/card/${baseKey}.jpg`,
        variants.card,
        'image/jpeg',
      ),
      this.storage.putObject(
        `uploads/thumb/${baseKey}.jpg`,
        variants.thumb,
        'image/jpeg',
      ),
    ]);

    // Publishes immediately (see docs/11-reviews-trust-safety.md's Phase 5 moderation decision).
    const photo = await this.prisma.photo.create({
      data: {
        userId,
        businessId: input.businessId ?? null,
        reviewId: input.reviewId ?? null,
        url,
        thumbUrl,
        cardUrl,
        caption: input.caption ?? null,
        isApproved: true,
      },
    });

    return {
      id: photo.id,
      url: photo.url,
      thumbUrl: photo.thumbUrl,
      cardUrl: photo.cardUrl,
      caption: photo.caption,
      createdAt: photo.createdAt.toISOString(),
    };
  }
}
