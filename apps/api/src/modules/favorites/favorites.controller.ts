import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import type {
  BusinessSummary,
  PaginationMeta,
  PaginationQuery,
  ToggleFavoriteRequest,
  ToggleFavoriteResponse,
} from '@buisnez/shared';
import {
  paginationQuerySchema,
  toggleFavoriteRequestSchema,
} from '@buisnez/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { FavoritesService } from './favorites.service';

@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post('toggle')
  toggle(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(toggleFavoriteRequestSchema))
    body: ToggleFavoriteRequest,
  ): Promise<ToggleFavoriteResponse> {
    return this.favoritesService.toggle(userId, body.businessId);
  }

  @Get('mine')
  listMine(
    @CurrentUser('id') userId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<{ data: BusinessSummary[]; meta: PaginationMeta }> {
    return this.favoritesService.listMine(userId, query.page, query.perPage);
  }

  @Get('mine/ids')
  myFavoriteIds(@CurrentUser('id') userId: string): Promise<string[]> {
    return this.favoritesService.myFavoriteIds(userId);
  }
}
