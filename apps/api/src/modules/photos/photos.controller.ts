import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type {
  ConfirmPhotoRequest,
  PresignPhotoRequest,
  PresignPhotoResponse,
  UploadedPhoto,
} from '@buisnez/shared';
import {
  confirmPhotoRequestSchema,
  presignPhotoRequestSchema,
} from '@buisnez/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { VerifiedEmailGuard } from '../../common/guards/verified-email.guard';
import { getClientIp } from '../../common/utils/client-ip';
import { PhotosService } from './photos.service';

@Controller('photos')
@UseGuards(VerifiedEmailGuard)
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('presign')
  presign(
    @Body(new ZodValidationPipe(presignPhotoRequestSchema))
    body: PresignPhotoRequest,
  ): Promise<PresignPhotoResponse> {
    return this.photosService.presign(body);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('confirm')
  confirm(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(confirmPhotoRequestSchema))
    body: ConfirmPhotoRequest,
    @Req() req: Request,
  ): Promise<UploadedPhoto> {
    return this.photosService.confirm(userId, body, getClientIp(req));
  }
}
