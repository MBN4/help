import { Controller, Get, Query } from '@nestjs/common';
import type { HomeDiscovery, RecentActivityItem } from '@buisnez/shared';
import { Public } from '../../common/decorators/public.decorator';
import { DiscoveryService } from './discovery.service';

const DEFAULT_RECENT_ACTIVITY_LIMIT = 9;

@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Public()
  @Get('home')
  getHome(): Promise<HomeDiscovery> {
    return this.discoveryService.getHome();
  }

  @Public()
  @Get('recent-activity')
  getRecentActivity(
    @Query('limit') limit?: string,
  ): Promise<RecentActivityItem[]> {
    const parsed = Number(limit);
    return this.discoveryService.getRecentActivity(
      Number.isFinite(parsed) && parsed > 0
        ? parsed
        : DEFAULT_RECENT_ACTIVITY_LIMIT,
    );
  }
}
