import { Module } from '@nestjs/common';
import { ModerationModule } from '../../integrations/moderation/moderation.module';
import { EditSuggestionsController } from './edit-suggestions.controller';
import { EditSuggestionsService } from './edit-suggestions.service';

@Module({
  imports: [ModerationModule],
  controllers: [EditSuggestionsController],
  providers: [EditSuggestionsService],
  exports: [EditSuggestionsService],
})
export class EditSuggestionsModule {}
