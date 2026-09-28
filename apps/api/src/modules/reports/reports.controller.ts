import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { CreateAppealRequest, CreateReportRequest } from '@buisnez/shared';
import {
  createAppealRequestSchema,
  createReportRequestSchema,
} from '@buisnez/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  create(
    @CurrentUser('id') reporterId: string,
    @Body(new ZodValidationPipe(createReportRequestSchema))
    body: CreateReportRequest,
  ): Promise<{ id: string }> {
    return this.reportsService.create(reporterId, body);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('appeal')
  createAppeal(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(createAppealRequestSchema))
    body: CreateAppealRequest,
  ): Promise<{ id: string }> {
    return this.reportsService.createAppeal(
      userId,
      body.targetType,
      body.targetId,
      body.message,
    );
  }
}
