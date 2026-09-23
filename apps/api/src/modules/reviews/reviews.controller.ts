import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import type { BusinessReview, CreateReviewRequest } from '@buisnez/shared';
import { createReviewRequestSchema } from '@buisnez/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { VerifiedEmailGuard } from '../../common/guards/verified-email.guard';
import { ReviewsService } from './reviews.service';

const myHelpfulVotesQuerySchema = z.object({ businessId: z.string().uuid() });

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Put('businesses/:businessId/review')
  @UseGuards(VerifiedEmailGuard)
  createOrUpdate(
    @CurrentUser('id') userId: string,
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(createReviewRequestSchema))
    body: CreateReviewRequest,
  ): Promise<BusinessReview> {
    return this.reviewsService.createOrUpdate(userId, businessId, body);
  }

  @Get('businesses/:businessId/review/mine')
  myReview(
    @CurrentUser('id') userId: string,
    @Param('businessId') businessId: string,
  ): Promise<BusinessReview | null> {
    return this.reviewsService.myReview(userId, businessId);
  }

  @Post('reviews/:reviewId/helpful')
  toggleHelpful(
    @CurrentUser('id') userId: string,
    @Param('reviewId') reviewId: string,
  ): Promise<{ helpful: boolean; helpfulCount: number }> {
    return this.reviewsService.toggleHelpful(userId, reviewId);
  }

  @Get('reviews/helpful-votes/mine')
  myHelpfulVotes(
    @CurrentUser('id') userId: string,
    @Query(new ZodValidationPipe(myHelpfulVotesQuerySchema))
    query: { businessId: string },
  ): Promise<string[]> {
    return this.reviewsService.myHelpfulVotes(userId, query.businessId);
  }
}
