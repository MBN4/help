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
import { ModerationService } from '../../integrations/moderation/moderation.service';
import { MailService } from '../../integrations/mail/mail.service';

// Uploads go straight to object storage before `confirm` ever sees them (see the presign→direct-upload
// pipeline in docs/11-reviews-trust-safety.md), so these guards are the only thing standing between an
// oversized/malformed file and the synchronous `sharp` pipeline below — there's no queue worker isolating
// this from the API process. See PROGRESS.md: move this to the BullMQ image queue once one exists so a
// pathological upload can't hold up a request thread at all.
const MAX_PHOTO_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_PHOTO_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const PROCESSING_TIMEOUT_MS = 15_000;

@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly imageProcessing: ImageProcessingService,
    private readonly moderationService: ModerationService,
    private readonly mailService: MailService,
  ) {}

  async presign(input: PresignPhotoRequest): Promise<PresignPhotoResponse> {
    const key = this.storage.generateUploadKey(input.contentType);
    const uploadUrl = await this.storage.presignUpload(key, input.contentType);
    return { uploadUrl, key };
  }

  async confirm(
    userId: string,
    input: ConfirmPhotoRequest,
    ipAddress: string | null,
  ): Promise<UploadedPhoto> {
    if (input.businessId) {
      const business = await this.prisma.business.findFirst({
        where: { id: input.businessId, status: 'PUBLISHED', deletedAt: null },
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

    return this.runPipeline(userId, input, ipAddress);
  }

  /**
   * Same upload pipeline as `confirm()`, but skips the `status: 'PUBLISHED'` business check — safe to call
   * only from a route that has already verified ownership of `businessId` (see `BusinessOwnerGuard`), since
   * an owner needs to add photos to their listing before/while it's still PENDING.
   */
  async confirmForBusiness(
    userId: string,
    businessId: string,
    input: ConfirmPhotoRequest,
    ipAddress: string | null,
  ): Promise<UploadedPhoto> {
    return this.runPipeline(userId, { ...input, businessId }, ipAddress);
  }

  async deleteForBusiness(businessId: string, photoId: string): Promise<void> {
    const photo = await this.prisma.photo.findUnique({
      where: { id: photoId },
      select: {
        id: true,
        businessId: true,
        url: true,
        thumbUrl: true,
        cardUrl: true,
      },
    });
    if (!photo || photo.businessId !== businessId) {
      throw new AppException(404, 'NOT_FOUND', 'Photo not found');
    }

    await this.prisma.photo.delete({ where: { id: photoId } });

    const keys = [photo.url, photo.thumbUrl, photo.cardUrl]
      .filter((url): url is string => Boolean(url))
      .map((url) => this.storage.keyFromPublicUrl(url))
      .filter((key): key is string => Boolean(key));
    await Promise.all(keys.map((key) => this.storage.deleteObject(key)));
  }

  private async runPipeline(
    userId: string,
    input: ConfirmPhotoRequest,
    ipAddress: string | null,
  ): Promise<UploadedPhoto> {
    const meta = await this.storage.headObject(input.key);
    if (meta.contentLength > MAX_PHOTO_UPLOAD_BYTES) {
      throw new AppException(
        400,
        'PHOTO_TOO_LARGE',
        `Upload exceeds the ${MAX_PHOTO_UPLOAD_BYTES / (1024 * 1024)}MB limit`,
      );
    }
    if (
      !meta.contentType ||
      !ALLOWED_PHOTO_CONTENT_TYPES.has(meta.contentType)
    ) {
      throw new AppException(
        400,
        'PHOTO_INVALID_TYPE',
        'Uploaded file is not a supported image type',
      );
    }

    const original = await this.storage.getObject(input.key);
    const variants = await this.withTimeout(
      this.imageProcessing.processVariants(original),
      PROCESSING_TIMEOUT_MS,
    );

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

    // Publishes immediately, pending the moderation-scoring pass below (see
    // docs/11-reviews-trust-safety.md's Phase 5 moderation decision, superseded by Phase 8's real scoring).
    const photo = await this.prisma.photo.create({
      data: {
        userId,
        businessId: input.businessId ?? null,
        reviewId: input.reviewId ?? null,
        url,
        thumbUrl,
        cardUrl,
        caption: input.caption ?? null,
        status: 'APPROVED',
        ipAddress,
      },
    });

    // Real automated flagging/scoring pass (Phase 8) — see ModerationService/ModerationScoringService.
    const moderation = await this.moderationService.enqueue({
      targetType: 'PHOTO',
      targetId: photo.id,
      userId,
      businessId: input.businessId ?? null,
      ipAddress,
      text: input.caption ?? null,
      rating: null,
    });

    const reasonSummary = moderation.reasons.join(', ') || null;
    const finalStatus =
      moderation.status === 'PENDING' ? 'PENDING' : 'APPROVED';
    if (finalStatus !== 'APPROVED') {
      await this.prisma.photo.update({
        where: { id: photo.id },
        data: { status: finalStatus, moderationReason: reasonSummary },
      });
    }

    if (finalStatus === 'PENDING') {
      const uploader = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (uploader) {
        this.mailService.notifyContentHeld(
          uploader.email,
          'PHOTO',
          moderation.reasons,
        );
      }
    }

    return {
      id: photo.id,
      url: photo.url,
      thumbUrl: photo.thumbUrl,
      cardUrl: photo.cardUrl,
      caption: photo.caption,
      createdAt: photo.createdAt.toISOString(),
    };
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new AppException(
              408,
              'PHOTO_PROCESSING_TIMEOUT',
              'Image processing took too long',
            ),
          ),
        ms,
      );
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }
}
