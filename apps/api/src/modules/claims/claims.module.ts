import { Module } from '@nestjs/common';
import { ModerationModule } from '../../integrations/moderation/moderation.module';
import { MailModule } from '../../integrations/mail/mail.module';
import { ClaimsController } from './claims.controller';
import { ClaimsService } from './claims.service';

@Module({
  imports: [ModerationModule, MailModule],
  controllers: [ClaimsController],
  providers: [ClaimsService],
  exports: [ClaimsService],
})
export class ClaimsModule {}
