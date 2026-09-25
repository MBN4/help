import { Body, Controller, Delete, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@buisnez/database';
import type {
  CreateAreaRequest,
  CreateCategoryRequest,
  CreateCityRequest,
  CreateFeatureRequest,
  CreateProvinceRequest,
  UpdateAreaRequest,
  UpdateCategoryRequest,
  UpdateCityRequest,
  UpdateFeatureRequest,
  UpdateProvinceRequest,
} from '@buisnez/shared';
import {
  createAreaRequestSchema,
  createCategoryRequestSchema,
  createCityRequestSchema,
  createFeatureRequestSchema,
  createProvinceRequestSchema,
  updateAreaRequestSchema,
  updateCategoryRequestSchema,
  updateCityRequestSchema,
  updateFeatureRequestSchema,
  updateProvinceRequestSchema,
} from '@buisnez/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminTaxonomyService } from './admin-taxonomy.service';

// Taxonomy is ADMIN-only end-to-end per the role split — MODERATOR never manages categories/locations/features.
@Controller('admin/taxonomy')
@Roles(Role.ADMIN)
export class AdminTaxonomyController {
  constructor(private readonly service: AdminTaxonomyService) {}

  @Post('categories')
  createCategory(
    @CurrentUser('id') actorId: string,
    @Body(new ZodValidationPipe(createCategoryRequestSchema))
    body: CreateCategoryRequest,
  ) {
    return this.service.createCategory(actorId, body);
  }

  @Patch('categories/:id')
  updateCategory(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCategoryRequestSchema))
    body: UpdateCategoryRequest,
  ) {
    return this.service.updateCategory(id, actorId, body);
  }

  @Delete('categories/:id')
  deleteCategory(@CurrentUser('id') actorId: string, @Param('id') id: string) {
    return this.service.deleteCategory(id, actorId);
  }

  @Post('provinces')
  createProvince(
    @CurrentUser('id') actorId: string,
    @Body(new ZodValidationPipe(createProvinceRequestSchema))
    body: CreateProvinceRequest,
  ) {
    return this.service.createProvince(actorId, body);
  }

  @Patch('provinces/:id')
  updateProvince(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProvinceRequestSchema))
    body: UpdateProvinceRequest,
  ) {
    return this.service.updateProvince(id, actorId, body);
  }

  @Delete('provinces/:id')
  deleteProvince(@CurrentUser('id') actorId: string, @Param('id') id: string) {
    return this.service.deleteProvince(id, actorId);
  }

  @Post('cities')
  createCity(
    @CurrentUser('id') actorId: string,
    @Body(new ZodValidationPipe(createCityRequestSchema))
    body: CreateCityRequest,
  ) {
    return this.service.createCity(actorId, body);
  }

  @Patch('cities/:id')
  updateCity(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCityRequestSchema))
    body: UpdateCityRequest,
  ) {
    return this.service.updateCity(id, actorId, body);
  }

  @Delete('cities/:id')
  deleteCity(@CurrentUser('id') actorId: string, @Param('id') id: string) {
    return this.service.deleteCity(id, actorId);
  }

  @Post('areas')
  createArea(
    @CurrentUser('id') actorId: string,
    @Body(new ZodValidationPipe(createAreaRequestSchema))
    body: CreateAreaRequest,
  ) {
    return this.service.createArea(actorId, body);
  }

  @Patch('areas/:id')
  updateArea(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAreaRequestSchema))
    body: UpdateAreaRequest,
  ) {
    return this.service.updateArea(id, actorId, body);
  }

  @Delete('areas/:id')
  deleteArea(@CurrentUser('id') actorId: string, @Param('id') id: string) {
    return this.service.deleteArea(id, actorId);
  }

  @Post('features')
  createFeature(
    @CurrentUser('id') actorId: string,
    @Body(new ZodValidationPipe(createFeatureRequestSchema))
    body: CreateFeatureRequest,
  ) {
    return this.service.createFeature(actorId, body);
  }

  @Patch('features/:id')
  updateFeature(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateFeatureRequestSchema))
    body: UpdateFeatureRequest,
  ) {
    return this.service.updateFeature(id, actorId, body);
  }

  @Delete('features/:id')
  deleteFeature(@CurrentUser('id') actorId: string, @Param('id') id: string) {
    return this.service.deleteFeature(id, actorId);
  }
}
