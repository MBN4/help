import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@buisnez/database';
import type {
  CreateAdminBusinessRequest,
  ListAdminBusinessesQuery,
  UpdateAdminBusinessRequest,
  UpdateBusinessFeaturedRequest,
  UpdateBusinessStatusRequest,
  UpdateBusinessVerifyRequest,
} from '@buisnez/shared';
import {
  createAdminBusinessRequestSchema,
  listAdminBusinessesQuerySchema,
  updateAdminBusinessRequestSchema,
  updateBusinessFeaturedRequestSchema,
  updateBusinessStatusRequestSchema,
  updateBusinessVerifyRequestSchema,
} from '@buisnez/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminBusinessesService } from './admin-businesses.service';

@Controller('admin/businesses')
export class AdminBusinessesController {
  constructor(private readonly service: AdminBusinessesService) {}

  @Roles(Role.MODERATOR, Role.ADMIN)
  @Get()
  list(
    @Query(new ZodValidationPipe(listAdminBusinessesQuerySchema))
    query: ListAdminBusinessesQuery,
  ) {
    return this.service.list(query);
  }

  @Roles(Role.MODERATOR, Role.ADMIN)
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Roles(Role.MODERATOR, Role.ADMIN)
  @Patch(':id/status')
  updateStatus(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateBusinessStatusRequestSchema))
    body: UpdateBusinessStatusRequest,
  ) {
    return this.service.updateStatus(id, actorId, body);
  }

  @Roles(Role.MODERATOR, Role.ADMIN)
  @Patch(':id/verify')
  updateVerify(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateBusinessVerifyRequestSchema))
    body: UpdateBusinessVerifyRequest,
  ) {
    return this.service.updateVerify(id, actorId, body.isVerified);
  }

  // ADMIN-only tier below (featured placement, direct creation, generic edit, soft-delete/restore).
  @Roles(Role.ADMIN)
  @Patch(':id/featured')
  updateFeatured(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateBusinessFeaturedRequestSchema))
    body: UpdateBusinessFeaturedRequest,
  ) {
    return this.service.updateFeatured(id, actorId, body);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(
    @CurrentUser('id') actorId: string,
    @Body(new ZodValidationPipe(createAdminBusinessRequestSchema))
    body: CreateAdminBusinessRequest,
  ) {
    return this.service.create(actorId, body);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAdminBusinessRequestSchema))
    body: UpdateAdminBusinessRequest,
  ) {
    return this.service.update(id, actorId, body);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  softDelete(@CurrentUser('id') actorId: string, @Param('id') id: string) {
    return this.service.softDelete(id, actorId);
  }

  @Roles(Role.ADMIN)
  @Post(':id/restore')
  restore(@CurrentUser('id') actorId: string, @Param('id') id: string) {
    return this.service.restore(id, actorId);
  }
}
