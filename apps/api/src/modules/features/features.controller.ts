import { Controller, Get } from '@nestjs/common';
import type { BusinessFeatureRef } from '@buisnez/shared';
import { Public } from '../../common/decorators/public.decorator';
import { FeaturesService } from './features.service';

@Controller('features')
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}

  @Public()
  @Get()
  list(): Promise<BusinessFeatureRef[]> {
    return this.featuresService.list();
  }
}
