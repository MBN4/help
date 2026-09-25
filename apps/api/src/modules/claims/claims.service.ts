import { Injectable } from '@nestjs/common';
import { Role } from '@buisnez/database';
import type { Claim, CreateClaimRequest } from '@buisnez/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { MailService } from '../../integrations/mail/mail.service';
import {
  ModerationLogService,
  MODERATION_ACTIONS,
} from '../../integrations/moderation/moderation-log.service';

@Injectable()
export class ClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationLog: ModerationLogService,
    private readonly mail: MailService,
  ) {}

  async create(userId: string, input: CreateClaimRequest): Promise<Claim> {
    const business = await this.prisma.business.findUnique({
      where: { id: input.businessId },
      select: { ownerId: true },
    });
    if (!business) {
      throw new AppException(404, 'NOT_FOUND', 'Business not found');
    }
    if (business.ownerId) {
      throw new AppException(
        409,
        'BUSINESS_ALREADY_OWNED',
        'This business is already owned',
      );
    }

    const pending = await this.prisma.claim.findFirst({
      where: { businessId: input.businessId, userId, status: 'PENDING' },
    });
    if (pending) {
      throw new AppException(
        409,
        'CLAIM_ALREADY_PENDING',
        'You already have a pending claim for this business',
      );
    }

    const claim = await this.prisma.claim.create({
      data: {
        businessId: input.businessId,
        userId,
        message: input.message ?? null,
        documentUrl: input.documentUrl ?? null,
      },
    });
    return this.toClaim(claim);
  }

  async myClaimForBusiness(
    userId: string,
    businessId: string,
  ): Promise<Claim | null> {
    const claim = await this.prisma.claim.findFirst({
      where: { businessId, userId },
      orderBy: { createdAt: 'desc' },
    });
    return claim ? this.toClaim(claim) : null;
  }

  async myClaims(userId: string): Promise<Claim[]> {
    const claims = await this.prisma.claim.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return claims.map((claim) => this.toClaim(claim));
  }

  /** Admin/moderator claims queue read — every claim at `status`, with claimant + target business joined. */
  async listAll(status: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING') {
    return this.prisma.claim.findMany({
      where: { status },
      include: {
        user: { select: { id: true, name: true, email: true } },
        business: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(
    claimId: string,
    actorId: string,
    verifyBusiness = false,
  ): Promise<Claim> {
    const claim = await this.prisma.claim.findUnique({
      where: { id: claimId },
    });
    if (!claim) {
      throw new AppException(404, 'NOT_FOUND', 'Claim not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const business = await tx.business.findUniqueOrThrow({
        where: { id: claim.businessId },
        select: { ownerId: true, name: true },
      });
      if (business.ownerId && business.ownerId !== claim.userId) {
        throw new AppException(
          409,
          'BUSINESS_ALREADY_OWNED',
          'This business is already owned by someone else',
        );
      }

      const approved = await tx.claim.update({
        where: { id: claimId },
        data: {
          status: 'APPROVED',
          reviewedById: actorId,
          reviewedAt: new Date(),
        },
      });

      await tx.business.update({
        where: { id: claim.businessId },
        data: {
          ownerId: claim.userId,
          ...(verifyBusiness ? { isVerified: true } : {}),
        },
      });

      const owner = await tx.user.findUniqueOrThrow({
        where: { id: claim.userId },
        select: { role: true, email: true },
      });
      // Cosmetic role field only — never downgrade an ADMIN/MODERATOR, and it's a no-op if already
      // BUSINESS_OWNER.
      if (owner.role === Role.CUSTOMER) {
        await tx.user.update({
          where: { id: claim.userId },
          data: { role: Role.BUSINESS_OWNER },
        });
      }

      return { approved, businessName: business.name, ownerEmail: owner.email };
    });

    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.CLAIM_APPROVED,
      targetType: 'CLAIM',
      targetId: claimId,
      reason: null,
      metadata: { businessId: claim.businessId, claimantUserId: claim.userId },
    });
    this.mail.notifyClaimDecision(
      updated.ownerEmail,
      updated.businessName,
      'approved',
    );

    return this.toClaim(updated.approved);
  }

  async reject(
    claimId: string,
    actorId: string,
    reason?: string,
  ): Promise<Claim> {
    const claim = await this.prisma.claim.findUnique({
      where: { id: claimId },
      include: {
        business: { select: { name: true } },
        user: { select: { email: true } },
      },
    });
    if (!claim) {
      throw new AppException(404, 'NOT_FOUND', 'Claim not found');
    }

    const updated = await this.prisma.claim.update({
      where: { id: claimId },
      data: {
        status: 'REJECTED',
        reviewedById: actorId,
        reviewedAt: new Date(),
      },
    });

    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.CLAIM_REJECTED,
      targetType: 'CLAIM',
      targetId: claimId,
      reason: reason ?? null,
      metadata: { businessId: claim.businessId, claimantUserId: claim.userId },
    });
    this.mail.notifyClaimDecision(
      claim.user.email,
      claim.business.name,
      'rejected',
    );

    return this.toClaim(updated);
  }

  private toClaim(claim: {
    id: string;
    businessId: string;
    userId: string;
    status: string;
    message: string | null;
    documentUrl: string | null;
    createdAt: Date;
    reviewedAt: Date | null;
  }): Claim {
    return {
      id: claim.id,
      businessId: claim.businessId,
      userId: claim.userId,
      status: claim.status as Claim['status'],
      message: claim.message,
      documentUrl: claim.documentUrl,
      createdAt: claim.createdAt.toISOString(),
      reviewedAt: claim.reviewedAt ? claim.reviewedAt.toISOString() : null,
    };
  }
}
