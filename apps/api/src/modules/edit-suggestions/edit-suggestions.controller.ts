import { Body, Controller, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { CreateEditSuggestionRequest } from '@buisnez/shared';
import { createEditSuggestionRequestSchema } from '@buisnez/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EditSuggestionsService } from './edit-suggestions.service';

@Controller('businesses/:businessId/suggest-edit')
export class EditSuggestionsController {
  constructor(
    private readonly editSuggestionsService: EditSuggestionsService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(createEditSuggestionRequestSchema))
    body: CreateEditSuggestionRequest,
  ): Promise<{ id: string }> {
    return this.editSuggestionsService.create(userId, businessId, body);
  }
}
