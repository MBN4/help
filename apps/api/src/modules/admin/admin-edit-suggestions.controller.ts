import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Role } from '@buisnez/database';
import type {
  EditSuggestion,
  ListEditSuggestionsQuery,
  ResolveEditSuggestionRequest,
} from '@buisnez/shared';
import {
  listEditSuggestionsQuerySchema,
  resolveEditSuggestionRequestSchema,
} from '@buisnez/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { EditSuggestionsService } from '../edit-suggestions/edit-suggestions.service';

@Controller('admin/edit-suggestions')
@Roles(Role.MODERATOR, Role.ADMIN)
export class AdminEditSuggestionsController {
  constructor(
    private readonly editSuggestionsService: EditSuggestionsService,
  ) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(listEditSuggestionsQuerySchema))
    query: ListEditSuggestionsQuery,
  ): Promise<EditSuggestion[]> {
    return this.editSuggestionsService.list(query);
  }

  @Patch(':id/resolve')
  resolve(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(resolveEditSuggestionRequestSchema))
    body: ResolveEditSuggestionRequest,
  ): Promise<{ resolved: true }> {
    return this.editSuggestionsService
      .resolve(id, actorId, body)
      .then(() => ({ resolved: true as const }));
  }
}
