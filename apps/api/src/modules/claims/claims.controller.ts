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
import type { Claim, CreateClaimRequest } from '@buisnez/shared';
import { createClaimRequestSchema } from '@buisnez/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Roles } from '../../common/decorators/roles.decorator';
import { ClaimsService } from './claims.service';

const myClaimsQuerySchema = z.object({
  businessId: z.string().uuid().optional(),
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

  @Roles(Role.ADMIN)
  @Patch(':id/approve')
  approve(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
  ): Promise<Claim> {
    return this.claimsService.approve(id, adminId);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/reject')
  reject(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
  ): Promise<Claim> {
    return this.claimsService.reject(id, adminId);
  }
}
