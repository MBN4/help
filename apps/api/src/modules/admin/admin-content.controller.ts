import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Role } from '@buisnez/database';
import type {
  ContentModerationStatusQuery,
  ModerationRemoveRequest,
  ModerationRestoreRequest,
} from '@buisnez/shared';
import {
  contentModerationStatusQuerySchema,
  moderationRemoveRequestSchema,
  moderationRestoreRequestSchema,
} from '@buisnez/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminContentService } from './admin-content.service';

@Controller('admin/content')
@Roles(Role.MODERATOR, Role.ADMIN)
export class AdminContentController {
  constructor(private readonly service: AdminContentService) {}

  @Get('reviews')
  listReviews(
    @Query(new ZodValidationPipe(contentModerationStatusQuerySchema))
    query: ContentModerationStatusQuery,
  ) {
    return this.service.listReviews(query.status, query.reported);
  }

  @Get('photos')
  listPhotos(
    @Query(new ZodValidationPipe(contentModerationStatusQuerySchema))
    query: ContentModerationStatusQuery,
  ) {
    return this.service.listPhotos(query.status, query.reported);
  }

  @Patch('reviews/:id/approve')
  approveReview(@CurrentUser('id') actorId: string, @Param('id') id: string) {
    return this.service.approveReview(id, actorId);
  }

  @Patch('reviews/:id/remove')
  removeReview(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(moderationRemoveRequestSchema))
    body: ModerationRemoveRequest,
  ) {
    return this.service.removeReview(id, actorId, body.reason);
  }

  @Patch('reviews/:id/restore')
  restoreReview(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(moderationRestoreRequestSchema))
    body: ModerationRestoreRequest,
  ) {
    return this.service.restoreReview(id, actorId, body.reason);
  }

  @Patch('photos/:id/approve')
  approvePhoto(@CurrentUser('id') actorId: string, @Param('id') id: string) {
    return this.service.approvePhoto(id, actorId);
  }

  @Patch('photos/:id/remove')
  removePhoto(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(moderationRemoveRequestSchema))
    body: ModerationRemoveRequest,
  ) {
    return this.service.removePhoto(id, actorId, body.reason);
  }

  @Patch('photos/:id/restore')
  restorePhoto(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(moderationRestoreRequestSchema))
    body: ModerationRestoreRequest,
  ) {
    return this.service.restorePhoto(id, actorId, body.reason);
  }
}
