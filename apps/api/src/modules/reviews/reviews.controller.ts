import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import type {
  BusinessReview,
  CreateReviewRequest,
  ReplyToReviewRequest,
} from '@buisnez/shared';
import {
  createReviewRequestSchema,
  replyToReviewRequestSchema,
} from '@buisnez/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { VerifiedEmailGuard } from '../../common/guards/verified-email.guard';
import { BusinessOwnerGuard } from '../../common/guards/business-owner.guard';
import { getClientIp } from '../../common/utils/client-ip';
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
    @Req() req: Request,
  ): Promise<BusinessReview> {
    return this.reviewsService.createOrUpdate(
      userId,
      businessId,
      body,
      getClientIp(req),
    );
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

  @Put('businesses/:businessId/reviews/:reviewId/reply')
  @UseGuards(BusinessOwnerGuard)
  replyToReview(
    @Param('businessId') businessId: string,
    @Param('reviewId') reviewId: string,
    @Body(new ZodValidationPipe(replyToReviewRequestSchema))
    body: ReplyToReviewRequest,
  ): Promise<BusinessReview> {
    return this.reviewsService.replyToReview(businessId, reviewId, body.reply);
  }

  @Delete('businesses/:businessId/reviews/:reviewId/reply')
  @UseGuards(BusinessOwnerGuard)
  deleteReply(
    @Param('businessId') businessId: string,
    @Param('reviewId') reviewId: string,
  ): Promise<BusinessReview> {
    return this.reviewsService.deleteReply(businessId, reviewId);
  }
}
