import { Controller, Get, Param, Query } from '@nestjs/common';
import type {
  AreaSummary,
  CityDetail,
  CitySummary,
  ListAreasQuery,
  ListCitiesQuery,
  ProvinceSummary,
} from '@buisnez/shared';
import { listAreasQuerySchema, listCitiesQuerySchema } from '@buisnez/shared';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Public()
  @Get('provinces')
  getProvinces(): Promise<ProvinceSummary[]> {
    return this.locationsService.getProvinces();
  }

  @Public()
  @Get('cities')
  getCities(
    @Query(new ZodValidationPipe(listCitiesQuerySchema)) query: ListCitiesQuery,
  ): Promise<CitySummary[]> {
    return this.locationsService.getCities(query.province);
  }

  @Public()
  @Get('cities/:slug')
  getCityBySlug(@Param('slug') slug: string): Promise<CityDetail> {
    return this.locationsService.getCityBySlug(slug);
  }

  @Public()
  @Get('areas')
  getAreas(
    @Query(new ZodValidationPipe(listAreasQuerySchema)) query: ListAreasQuery,
  ): Promise<AreaSummary[]> {
    return this.locationsService.getAreas(query.city);
  }
}
