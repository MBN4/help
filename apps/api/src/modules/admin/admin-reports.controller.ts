import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Role } from '@buisnez/database';
import type {
  DismissReportRequest,
  ListAdminReportsQuery,
  ResolveReportRequest,
} from '@buisnez/shared';
import {
  dismissReportRequestSchema,
  listAdminReportsQuerySchema,
  resolveReportRequestSchema,
} from '@buisnez/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminReportsService } from './admin-reports.service';

@Controller('admin/reports')
@Roles(Role.MODERATOR, Role.ADMIN)
export class AdminReportsController {
  constructor(private readonly service: AdminReportsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(listAdminReportsQuerySchema))
    query: ListAdminReportsQuery,
  ) {
    return this.service.listGrouped(query.status);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.service.getDetail(id);
  }

  @Patch(':id/resolve')
  resolve(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(resolveReportRequestSchema))
    body: ResolveReportRequest,
  ) {
    return this.service.resolve(id, actorId, body);
  }

  @Patch(':id/dismiss')
  dismiss(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(dismissReportRequestSchema))
    body: DismissReportRequest,
  ) {
    return this.service.dismiss(id, actorId, body.reason);
  }
}
