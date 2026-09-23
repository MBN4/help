import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import type {
  AuthUser,
  MyPhoto,
  MyReview,
  PaginationMeta,
  PaginationQuery,
  UpdateProfileRequest,
} from '@buisnez/shared';
import {
  paginationQuerySchema,
  updateProfileRequestSchema,
} from '@buisnez/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UsersService } from './users.service';

@Controller('users/me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch()
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(updateProfileRequestSchema))
    body: UpdateProfileRequest,
  ): Promise<AuthUser> {
    return this.usersService.updateProfile(userId, body);
  }

  @Get('reviews')
  myReviews(
    @CurrentUser('id') userId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<{ data: MyReview[]; meta: PaginationMeta }> {
    return this.usersService.myReviews(userId, query.page, query.perPage);
  }

  @Get('photos')
  myPhotos(
    @CurrentUser('id') userId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<{ data: MyPhoto[]; meta: PaginationMeta }> {
    return this.usersService.myPhotos(userId, query.page, query.perPage);
  }
}
