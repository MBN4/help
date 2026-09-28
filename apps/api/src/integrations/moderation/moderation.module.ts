import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ModerationService } from './moderation.service';
import { ModerationScoringService } from './moderation-scoring.service';
import { ModerationLogService } from './moderation-log.service';

@Module({
  imports: [PrismaModule],
  providers: [
    ModerationService,
    ModerationScoringService,
    ModerationLogService,
  ],
  exports: [ModerationService, ModerationScoringService, ModerationLogService],
})
export class ModerationModule {}
