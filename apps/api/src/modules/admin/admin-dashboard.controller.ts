import { Controller, Get } from '@nestjs/common';
import { Role } from '@buisnez/database';
import type { AdminDashboard } from '@buisnez/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminDashboardService } from './admin-dashboard.service';

@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly service: AdminDashboardService) {}

  @Roles(Role.MODERATOR, Role.ADMIN)
  @Get()
  getDashboard(): Promise<AdminDashboard> {
    return this.service.getDashboard();
  }
}
