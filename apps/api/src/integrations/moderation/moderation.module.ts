import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ModerationService } from './moderation.service';
import { ModerationLogService } from './moderation-log.service';

@Module({
  imports: [PrismaModule],
  providers: [ModerationService, ModerationLogService],
  exports: [ModerationService, ModerationLogService],
})
export class ModerationModule {}
