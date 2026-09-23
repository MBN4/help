import { Controller, Get } from '@nestjs/common';
import type { HomeDiscovery } from '@buisnez/shared';
import { Public } from '../../common/decorators/public.decorator';
import { DiscoveryService } from './discovery.service';

@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Public()
  @Get('home')
  getHome(): Promise<HomeDiscovery> {
    return this.discoveryService.getHome();
  }
}
