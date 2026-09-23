import { Controller, Get, Param, Query } from '@nestjs/common';
import type {
  BusinessPhoto,
  BusinessProfile,
  BusinessReview,
  BusinessSearchQuery,
  BusinessSummary,
  PaginationMeta,
  PaginationQuery,
} from '@buisnez/shared';
import {
  businessSearchQuerySchema,
  paginationQuerySchema,
} from '@buisnez/shared';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { BusinessesService } from './businesses.service';
import { SearchService } from '../search/search.service';

const SIMILAR_LIMIT = 6;

@Controller('businesses')
export class BusinessesController {
  constructor(
    private readonly businessesService: BusinessesService,
    private readonly searchService: SearchService,
  ) {}

  @Public()
  @Get()
  search(
    @Query(new ZodValidationPipe(businessSearchQuerySchema))
    query: BusinessSearchQuery,
  ): Promise<{ data: BusinessSummary[]; meta: PaginationMeta }> {
    return this.searchService.search(query);
  }

  @Public()
  @Get(':slug')
  getProfile(@Param('slug') slug: string): Promise<BusinessProfile> {
    return this.businessesService.getProfileBySlug(slug);
  }

  @Public()
  @Get(':id/reviews')
  getReviews(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<{ data: BusinessReview[]; meta: PaginationMeta }> {
    return this.businessesService.getReviews(id, query.page, query.perPage);
  }

  @Public()
  @Get(':id/photos')
  getPhotos(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<{ data: BusinessPhoto[]; meta: PaginationMeta }> {
    return this.businessesService.getPhotos(id, query.page, query.perPage);
  }

  @Public()
  @Get(':slug/similar')
  getSimilar(@Param('slug') slug: string): Promise<BusinessSummary[]> {
    return this.businessesService.getSimilar(slug, SIMILAR_LIMIT);
  }
}
