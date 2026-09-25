import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Role } from '@buisnez/database';
import type {
  BanUserRequest,
  ChangeUserRoleRequest,
  ListAdminUsersQuery,
} from '@buisnez/shared';
import {
  banUserRequestSchema,
  changeUserRoleRequestSchema,
  listAdminUsersQuerySchema,
} from '@buisnez/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminUsersService } from './admin-users.service';

// ADMIN-only surface end-to-end (users/roles) — MODERATOR must be blocked, per the role split.
@Controller('admin/users')
@Roles(Role.ADMIN)
export class AdminUsersController {
  constructor(private readonly service: AdminUsersService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(listAdminUsersQuerySchema))
    query: ListAdminUsersQuery,
  ) {
    return this.service.list(query);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Patch(':id/ban')
  ban(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(banUserRequestSchema)) body: BanUserRequest,
  ) {
    return this.service.ban(id, actorId, body.reason);
  }

  @Patch(':id/unban')
  unban(@CurrentUser('id') actorId: string, @Param('id') id: string) {
    return this.service.unban(id, actorId);
  }

  @Patch(':id/role')
  changeRole(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(changeUserRoleRequestSchema))
    body: ChangeUserRoleRequest,
  ) {
    return this.service.changeRole(id, actorId, body.role as Role);
  }
}
