import { Module } from '@nestjs/common';
import { DiscoveryModule } from '../discovery/discovery.module';
import { RevalidateModule } from '../../integrations/revalidate/revalidate.module';
import { ModerationModule } from '../../integrations/moderation/moderation.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [DiscoveryModule, RevalidateModule, ModerationModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
