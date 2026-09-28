import { Injectable } from '@nestjs/common';
import type {
  CreateEditSuggestionRequest,
  EditSuggestion,
  ResolveEditSuggestionRequest,
} from '@buisnez/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import {
  ModerationLogService,
  MODERATION_ACTIONS,
} from '../../integrations/moderation/moderation-log.service';

/**
 * "Suggest an edit" / report-incorrect-info flow (Phase 8) — a structured (field + suggested value)
 * correction submitted by any signed-in visitor on a business profile, tracked separately from abuse
 * Reports since it isn't a trust/safety complaint. Feeds both the moderation queue (`/admin/edit-suggestions`)
 * and the business owner's own view. See docs/11-reviews-trust-safety.md.
 *
 * Deliberately does not auto-apply the suggested value to the `Business` row on accept — the field is
 * free-text with no per-field validation here, so blindly writing it would bypass every constraint the real
 * business-edit endpoints enforce (see docs/12-admin-panel.md's leaner-than-full-spec precedent). "Accept"
 * is bookkeeping: the moderator or owner still makes the actual correction via the existing business-edit
 * endpoints after reviewing it here.
 */
@Injectable()
export class EditSuggestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationLog: ModerationLogService,
  ) {}

  async create(
    userId: string,
    businessId: string,
    input: CreateEditSuggestionRequest,
  ): Promise<{ id: string }> {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, status: 'PUBLISHED', deletedAt: null },
      select: { id: true },
    });
    if (!business) {
      throw new AppException(404, 'NOT_FOUND', 'Business not found');
    }

    const suggestion = await this.prisma.businessEditSuggestion.create({
      data: {
        businessId,
        userId,
        field: input.field,
        currentValue: input.currentValue ?? null,
        suggestedValue: input.suggestedValue,
        note: input.note ?? null,
      },
      select: { id: true },
    });

    await this.moderationLog.record({
      actorId: null,
      action: MODERATION_ACTIONS.EDIT_SUGGESTION_CREATED,
      targetType: 'EDIT_SUGGESTION',
      targetId: suggestion.id,
      metadata: { businessId, userId, field: input.field },
    });

    return suggestion;
  }

  async listForBusiness(businessId: string): Promise<EditSuggestion[]> {
    return this.list({ businessId });
  }

  async list(filter: {
    status?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
    businessId?: string;
  }): Promise<EditSuggestion[]> {
    const rows = await this.prisma.businessEditSuggestion.findMany({
      where: {
        status: filter.status,
        businessId: filter.businessId,
      },
      include: {
        business: { select: { id: true, name: true, slug: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      businessId: row.businessId,
      business: row.business,
      userId: row.userId,
      userName: row.user.name,
      field: row.field,
      currentValue: row.currentValue,
      suggestedValue: row.suggestedValue,
      note: row.note,
      status: row.status,
      resolvedById: row.resolvedById,
      resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
      resolutionNote: row.resolutionNote,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async resolve(
    id: string,
    actorId: string,
    input: ResolveEditSuggestionRequest,
  ): Promise<void> {
    const suggestion = await this.prisma.businessEditSuggestion.findUnique({
      where: { id },
    });
    if (!suggestion) {
      throw new AppException(404, 'NOT_FOUND', 'Edit suggestion not found');
    }
    if (suggestion.status !== 'PENDING') {
      throw new AppException(
        409,
        'ALREADY_RESOLVED',
        'This suggestion was already resolved',
      );
    }

    await this.prisma.businessEditSuggestion.update({
      where: { id },
      data: {
        status: input.status,
        resolvedById: actorId,
        resolvedAt: new Date(),
        resolutionNote: input.resolutionNote ?? null,
      },
    });

    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.EDIT_SUGGESTION_RESOLVED,
      targetType: 'EDIT_SUGGESTION',
      targetId: id,
      reason: input.resolutionNote ?? null,
      metadata: { status: input.status, businessId: suggestion.businessId },
    });
  }

  /** Used by the owner-facing resolve route to confirm the caller owns the suggestion's business — the
   * route itself is already `BusinessOwnerGuard`-protected on `:businessId`, this just cross-checks the id. */
  async assertBelongsToBusiness(id: string, businessId: string): Promise<void> {
    const suggestion = await this.prisma.businessEditSuggestion.findUnique({
      where: { id },
      select: { businessId: true },
    });
    if (!suggestion || suggestion.businessId !== businessId) {
      throw new AppException(404, 'NOT_FOUND', 'Edit suggestion not found');
    }
  }
}
