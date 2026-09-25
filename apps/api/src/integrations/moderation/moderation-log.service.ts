import { Injectable } from '@nestjs/common';
import { ModerationTargetType, Prisma } from '@buisnez/database';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Free-form action strings recorded on `ModerationLog.action`. Intentionally a TS const object, not a Prisma
 * enum, so adding a new action later never needs a migration (see docs/12-admin-panel.md).
 */
export const MODERATION_ACTIONS = {
  CLAIM_APPROVED: 'CLAIM_APPROVED',
  CLAIM_REJECTED: 'CLAIM_REJECTED',
  REVIEW_APPROVED: 'REVIEW_APPROVED',
  REVIEW_REMOVED: 'REVIEW_REMOVED',
  REVIEW_RESTORED: 'REVIEW_RESTORED',
  PHOTO_APPROVED: 'PHOTO_APPROVED',
  PHOTO_REMOVED: 'PHOTO_REMOVED',
  PHOTO_RESTORED: 'PHOTO_RESTORED',
  BUSINESS_STATUS_CHANGED: 'BUSINESS_STATUS_CHANGED',
  BUSINESS_VERIFIED_TOGGLED: 'BUSINESS_VERIFIED_TOGGLED',
  BUSINESS_FEATURED_TOGGLED: 'BUSINESS_FEATURED_TOGGLED',
  BUSINESS_CREATED: 'BUSINESS_CREATED',
  BUSINESS_UPDATED: 'BUSINESS_UPDATED',
  BUSINESS_SOFT_DELETED: 'BUSINESS_SOFT_DELETED',
  BUSINESS_RESTORED: 'BUSINESS_RESTORED',
  USER_BANNED: 'USER_BANNED',
  USER_UNBANNED: 'USER_UNBANNED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  REPORT_RESOLVED: 'REPORT_RESOLVED',
  REPORT_DISMISSED: 'REPORT_DISMISSED',
  CATEGORY_CREATED: 'CATEGORY_CREATED',
  CATEGORY_UPDATED: 'CATEGORY_UPDATED',
  CATEGORY_DELETED: 'CATEGORY_DELETED',
  PROVINCE_CREATED: 'PROVINCE_CREATED',
  PROVINCE_UPDATED: 'PROVINCE_UPDATED',
  PROVINCE_DELETED: 'PROVINCE_DELETED',
  CITY_CREATED: 'CITY_CREATED',
  CITY_UPDATED: 'CITY_UPDATED',
  CITY_DELETED: 'CITY_DELETED',
  AREA_CREATED: 'AREA_CREATED',
  AREA_UPDATED: 'AREA_UPDATED',
  AREA_DELETED: 'AREA_DELETED',
  FEATURE_CREATED: 'FEATURE_CREATED',
  FEATURE_UPDATED: 'FEATURE_UPDATED',
  FEATURE_DELETED: 'FEATURE_DELETED',
} as const;

export type ModerationAction =
  (typeof MODERATION_ACTIONS)[keyof typeof MODERATION_ACTIONS];

export interface RecordModerationLogInput {
  actorId: string;
  action: ModerationAction | (string & {});
  targetType: ModerationTargetType;
  targetId: string;
  reason?: string | null;
  notes?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}

/**
 * Thin, dumb writer for the `ModerationLog` audit trail — every consequential admin/moderator action calls
 * this after (or as part of) the transaction that performs the real effect. Read-side filtering lives in
 * `AdminModerationLogController`. See docs/12-admin-panel.md.
 */
@Injectable()
export class ModerationLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordModerationLogInput): Promise<void> {
    await this.prisma.moderationLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason ?? null,
        notes: input.notes ?? null,
        metadata: input.metadata ?? Prisma.JsonNull,
      },
    });
  }
}
