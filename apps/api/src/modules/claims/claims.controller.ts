import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { Role } from '@buisnez/database';
import type {
  ApproveClaimRequest,
  Claim,
  CreateClaimRequest,
  RejectClaimRequest,
} from '@buisnez/shared';
import {
  approveClaimRequestSchema,
  createClaimRequestSchema,
  rejectClaimRequestSchema,
} from '@buisnez/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Roles } from '../../common/decorators/roles.decorator';
import { ClaimsService } from './claims.service';

const myClaimsQuerySchema = z.object({
  businessId: z.string().uuid().optional(),
});

const listClaimsQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING'),
});

@Controller('claims')
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(createClaimRequestSchema))
    body: CreateClaimRequest,
  ): Promise<Claim> {
    return this.claimsService.create(userId, body);
  }

  @Get('mine')
  async mine(
    @CurrentUser('id') userId: string,
    @Query(new ZodValidationPipe(myClaimsQuerySchema))
    query: { businessId?: string },
  ): Promise<{ data: Claim | Claim[] | null }> {
    if (query.businessId) {
      const claim = await this.claimsService.myClaimForBusiness(
        userId,
        query.businessId,
      );
      return { data: claim };
    }
    const claims = await this.claimsService.myClaims(userId);
    return { data: claims };
  }

  // Admin/moderator claims queue (Phase 7) — the pre-Phase-7 service only exposed per-user listing, so this
  // new read was added rather than duplicating approve/reject logic under /admin. See docs/12-admin-panel.md.
  @Roles(Role.MODERATOR, Role.ADMIN)
  @Get()
  list(
    @Query(new ZodValidationPipe(listClaimsQuerySchema))
    query: {
      status: 'PENDING' | 'APPROVED' | 'REJECTED';
    },
  ) {
    return this.claimsService.listAll(query.status);
  }

  // Loosened from ADMIN-only in Phase 6 to MODERATOR+ADMIN in Phase 7 — MODERATOR is the day-to-day claims
  // queue worker (see docs/10-auth-roles.md's role split).
  @Roles(Role.MODERATOR, Role.ADMIN)
  @Patch(':id/approve')
  approve(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(approveClaimRequestSchema))
    body: ApproveClaimRequest,
  ): Promise<Claim> {
    return this.claimsService.approve(id, actorId, body.verifyBusiness);
  }

  @Roles(Role.MODERATOR, Role.ADMIN)
  @Patch(':id/reject')
  reject(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rejectClaimRequestSchema))
    body: RejectClaimRequest,
  ): Promise<Claim> {
    return this.claimsService.reject(id, actorId, body.reason);
  }
}
