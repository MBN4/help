import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type {
  BusinessFeaturesUpdate,
  BusinessHoursUpdate,
  BusinessLocationUpdate,
  BusinessManageProfile,
  BusinessOwnerSummary,
  BusinessServiceItem,
  ConfirmPhotoRequest,
  CreateBusinessServiceRequest,
  UpdateBusinessInfoRequest,
  UpdateBusinessServiceRequest,
  UploadedPhoto,
} from '@buisnez/shared';
import {
  businessFeaturesUpdateSchema,
  businessHoursUpdateSchema,
  businessLocationUpdateSchema,
  confirmPhotoRequestSchema,
  createBusinessServiceRequestSchema,
  updateBusinessInfoRequestSchema,
  updateBusinessServiceRequestSchema,
} from '@buisnez/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { BusinessOwnerGuard } from '../../common/guards/business-owner.guard';
import { BusinessOwnerService } from './business-owner.service';

const confirmOwnerPhotoRequestSchema = confirmPhotoRequestSchema.omit({
  businessId: true,
});

/**
 * Owner-mutation routes for a business, gated per-business by `BusinessOwnerGuard` (never role-based — see
 * docs/10-auth-roles.md). Registered BEFORE `BusinessesController` in `BusinessesModule` so `owned/mine`
 * (a static segment) is matched before `BusinessesController`'s `@Get(':slug')` catch-all.
 */
@Controller('businesses')
export class BusinessOwnerController {
  constructor(private readonly businessOwnerService: BusinessOwnerService) {}

  @Get('owned/mine')
  listMine(@CurrentUser('id') userId: string): Promise<BusinessOwnerSummary[]> {
    return this.businessOwnerService.listMine(userId);
  }

  @Get(':businessId/manage')
  @UseGuards(BusinessOwnerGuard)
  getManageProfile(
    @Param('businessId') businessId: string,
  ): Promise<BusinessManageProfile> {
    return this.businessOwnerService.getManageProfile(businessId);
  }

  @Patch(':businessId')
  @UseGuards(BusinessOwnerGuard)
  updateInfo(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(updateBusinessInfoRequestSchema))
    body: UpdateBusinessInfoRequest,
  ): Promise<BusinessManageProfile> {
    return this.businessOwnerService.updateInfo(businessId, body);
  }

  @Put(':businessId/hours')
  @UseGuards(BusinessOwnerGuard)
  updateHours(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(businessHoursUpdateSchema))
    body: BusinessHoursUpdate,
  ): Promise<BusinessManageProfile> {
    return this.businessOwnerService.updateHours(businessId, body);
  }

  @Put(':businessId/features')
  @UseGuards(BusinessOwnerGuard)
  updateFeatures(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(businessFeaturesUpdateSchema))
    body: BusinessFeaturesUpdate,
  ): Promise<BusinessManageProfile> {
    return this.businessOwnerService.updateFeatures(businessId, body);
  }

  @Patch(':businessId/location')
  @UseGuards(BusinessOwnerGuard)
  updateLocation(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(businessLocationUpdateSchema))
    body: BusinessLocationUpdate,
  ): Promise<BusinessManageProfile> {
    return this.businessOwnerService.updateLocation(businessId, body);
  }

  @Post(':businessId/services')
  @UseGuards(BusinessOwnerGuard)
  createService(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(createBusinessServiceRequestSchema))
    body: CreateBusinessServiceRequest,
  ): Promise<BusinessServiceItem> {
    return this.businessOwnerService.createService(businessId, body);
  }

  @Patch(':businessId/services/:serviceId')
  @UseGuards(BusinessOwnerGuard)
  updateService(
    @Param('businessId') businessId: string,
    @Param('serviceId') serviceId: string,
    @Body(new ZodValidationPipe(updateBusinessServiceRequestSchema))
    body: UpdateBusinessServiceRequest,
  ): Promise<BusinessServiceItem> {
    return this.businessOwnerService.updateService(businessId, serviceId, body);
  }

  @Delete(':businessId/services/:serviceId')
  @UseGuards(BusinessOwnerGuard)
  deleteService(
    @Param('businessId') businessId: string,
    @Param('serviceId') serviceId: string,
  ): Promise<{ deleted: true }> {
    return this.businessOwnerService
      .deleteService(businessId, serviceId)
      .then(() => ({ deleted: true as const }));
  }

  @Post(':businessId/photos')
  @UseGuards(BusinessOwnerGuard)
  addPhoto(
    @CurrentUser('id') userId: string,
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(confirmOwnerPhotoRequestSchema))
    body: Omit<ConfirmPhotoRequest, 'businessId'>,
  ): Promise<UploadedPhoto> {
    return this.businessOwnerService.addPhoto(userId, businessId, body);
  }

  @Delete(':businessId/photos/:photoId')
  @UseGuards(BusinessOwnerGuard)
  deletePhoto(
    @Param('businessId') businessId: string,
    @Param('photoId') photoId: string,
  ): Promise<{ deleted: true }> {
    return this.businessOwnerService
      .deletePhoto(businessId, photoId)
      .then(() => ({ deleted: true as const }));
  }
}
