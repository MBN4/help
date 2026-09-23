import { Module } from '@nestjs/common';
import { DiscoveryModule } from '../discovery/discovery.module';
import { RevalidateModule } from '../../integrations/revalidate/revalidate.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [DiscoveryModule, RevalidateModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
