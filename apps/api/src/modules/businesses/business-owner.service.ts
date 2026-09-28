import { Injectable } from '@nestjs/common';
import type {
  BusinessFeaturesUpdate,
  BusinessHoursUpdate,
  BusinessLocationUpdate,
  BusinessManageProfile,
  BusinessOwnerSummary,
  BusinessServiceItem,
  CreateBusinessServiceRequest,
  UpdateBusinessInfoRequest,
  UpdateBusinessServiceRequest,
  UploadedPhoto,
  ConfirmPhotoRequest,
} from '@buisnez/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { GeoService } from '../geo/geo.service';
import { RevalidateService } from '../../integrations/revalidate/revalidate.service';
import { PhotosService } from '../photos/photos.service';
import {
  DAY_ORDER,
  computeIsOpenNow,
  getBusinessAggregates,
} from './business-profile.util';

@Injectable()
export class BusinessOwnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geoService: GeoService,
    private readonly revalidateService: RevalidateService,
    private readonly photosService: PhotosService,
  ) {}

  async listMine(userId: string): Promise<BusinessOwnerSummary[]> {
    const businesses = await this.prisma.business.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      businesses.map(async (business) => {
        const aggregates = await getBusinessAggregates(
          this.prisma,
          business.id,
        );
        return {
          id: business.id,
          slug: business.slug,
          name: business.name,
          status: business.status,
          averageRating: aggregates.averageRating,
          reviewCount: aggregates.reviewCount,
          createdAt: business.createdAt.toISOString(),
        };
      }),
    );
  }

  async getManageProfile(businessId: string): Promise<BusinessManageProfile> {
    const business = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      include: {
        category: { include: { parent: true } },
        province: true,
        city: true,
        area: true,
        hours: true,
        features: { include: { feature: true } },
        services: { orderBy: { sortOrder: 'asc' } },
      },
    });

    const [location, aggregates] = await Promise.all([
      this.geoService.getBusinessLocation(business.id),
      getBusinessAggregates(this.prisma, business.id),
    ]);

    const hours = [...business.hours].sort(
      (a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek),
    );

    return {
      id: business.id,
      slug: business.slug,
      name: business.name,
      description: business.description,
      addressLine: business.addressLine,
      location,
      phone: business.phone,
      whatsapp: business.whatsapp,
      email: business.email,
      website: business.website,
      priceTier: business.priceTier,
      isVerified: business.isVerified,
      status: business.status,
      ownerId: business.ownerId,
      category: {
        id: business.category.id,
        name: business.category.name,
        slug: business.category.slug,
        parent: business.category.parent
          ? {
              id: business.category.parent.id,
              name: business.category.parent.name,
              slug: business.category.parent.slug,
            }
          : null,
      },
      province: { name: business.province.name, slug: business.province.slug },
      city: { name: business.city.name, slug: business.city.slug },
      area: business.area
        ? { name: business.area.name, slug: business.area.slug }
        : null,
      hours: hours.map((hour) => ({
        dayOfWeek: hour.dayOfWeek,
        opensAt: hour.opensAt,
        closesAt: hour.closesAt,
        isClosed: hour.isClosed,
      })),
      isOpenNow: computeIsOpenNow(hours),
      features: business.features.map(({ feature }) => ({
        id: feature.id,
        name: feature.name,
        slug: feature.slug,
        icon: feature.icon,
      })),
      aggregates,
      services: business.services.map((service) => this.toServiceItem(service)),
      createdAt: business.createdAt.toISOString(),
    };
  }

  async updateInfo(
    businessId: string,
    input: UpdateBusinessInfoRequest,
  ): Promise<BusinessManageProfile> {
    await this.prisma.business.update({
      where: { id: businessId },
      data: {
        name: input.name,
        description: input.description,
        categoryId: input.categoryId,
        phone: input.phone,
        whatsapp: input.whatsapp,
        email: input.email,
        website: input.website,
      },
    });

    // Note: `updateBusinessInfoRequestSchema` (per the Phase 6 spec) has no address/city/area fields, so
    // there's no "address changed" event to trigger `geoService.geocodeAddress()` from in this phase — the
    // location PATCH endpoint (below) is the only write path for a business's coordinate, and it always uses
    // the exact pin the owner dropped. `geocodeAddress()` stays unused by new code; see the handback report.
    await this.revalidateAfterWrite(businessId);
    return this.getManageProfile(businessId);
  }

  async updateHours(
    businessId: string,
    input: BusinessHoursUpdate,
  ): Promise<BusinessManageProfile> {
    await this.prisma.$transaction([
      this.prisma.businessHours.deleteMany({ where: { businessId } }),
      this.prisma.businessHours.createMany({
        data: input.map((entry) => ({
          businessId,
          dayOfWeek: entry.dayOfWeek,
          opensAt: entry.opensAt,
          closesAt: entry.closesAt,
          isClosed: entry.isClosed,
        })),
      }),
    ]);

    await this.revalidateAfterWrite(businessId);
    return this.getManageProfile(businessId);
  }

  async updateFeatures(
    businessId: string,
    input: BusinessFeaturesUpdate,
  ): Promise<BusinessManageProfile> {
    if (input.featureIds.length > 0) {
      const existing = await this.prisma.feature.findMany({
        where: { id: { in: input.featureIds } },
        select: { id: true },
      });
      if (existing.length !== input.featureIds.length) {
        throw new AppException(
          400,
          'INVALID_FEATURE_ID',
          'One or more featureIds do not exist',
        );
      }
    }

    await this.prisma.$transaction([
      this.prisma.businessFeature.deleteMany({ where: { businessId } }),
      this.prisma.businessFeature.createMany({
        data: input.featureIds.map((featureId) => ({ businessId, featureId })),
      }),
    ]);

    await this.revalidateAfterWrite(businessId);
    return this.getManageProfile(businessId);
  }

  async updateLocation(
    businessId: string,
    input: BusinessLocationUpdate,
  ): Promise<BusinessManageProfile> {
    await this.geoService.setBusinessLocation(businessId, input.lat, input.lng);
    await this.revalidateAfterWrite(businessId);
    return this.getManageProfile(businessId);
  }

  async createService(
    businessId: string,
    input: CreateBusinessServiceRequest,
  ): Promise<BusinessServiceItem> {
    const service = await this.prisma.businessService.create({
      data: {
        businessId,
        name: input.name,
        description: input.description ?? null,
        priceInPaisa: input.priceInPaisa ?? null,
        isAvailable: input.isAvailable ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
    });
    await this.revalidateAfterWrite(businessId);
    return this.toServiceItem(service);
  }

  async updateService(
    businessId: string,
    serviceId: string,
    input: UpdateBusinessServiceRequest,
  ): Promise<BusinessServiceItem> {
    await this.assertServiceBelongsToBusiness(businessId, serviceId);

    const service = await this.prisma.businessService.update({
      where: { id: serviceId },
      data: {
        name: input.name,
        description: input.description,
        priceInPaisa: input.priceInPaisa,
        isAvailable: input.isAvailable,
        sortOrder: input.sortOrder,
      },
    });
    await this.revalidateAfterWrite(businessId);
    return this.toServiceItem(service);
  }

  async deleteService(businessId: string, serviceId: string): Promise<void> {
    await this.assertServiceBelongsToBusiness(businessId, serviceId);
    await this.prisma.businessService.delete({ where: { id: serviceId } });
    await this.revalidateAfterWrite(businessId);
  }

  async addPhoto(
    userId: string,
    businessId: string,
    input: Omit<ConfirmPhotoRequest, 'businessId'>,
    ipAddress: string | null,
  ): Promise<UploadedPhoto> {
    const photo = await this.photosService.confirmForBusiness(
      userId,
      businessId,
      { ...input, businessId },
      ipAddress,
    );
    await this.revalidateAfterWrite(businessId);
    return photo;
  }

  async deletePhoto(businessId: string, photoId: string): Promise<void> {
    await this.photosService.deleteForBusiness(businessId, photoId);
    await this.revalidateAfterWrite(businessId);
  }

  private async assertServiceBelongsToBusiness(
    businessId: string,
    serviceId: string,
  ): Promise<void> {
    const service = await this.prisma.businessService.findUnique({
      where: { id: serviceId },
      select: { businessId: true },
    });
    if (!service || service.businessId !== businessId) {
      throw new AppException(404, 'NOT_FOUND', 'Service not found');
    }
  }

  private toServiceItem(service: {
    id: string;
    businessId: string;
    name: string;
    description: string | null;
    priceInPaisa: number | null;
    isAvailable: boolean;
    sortOrder: number;
    createdAt: Date;
  }): BusinessServiceItem {
    return {
      id: service.id,
      businessId: service.businessId,
      name: service.name,
      description: service.description,
      priceInPaisa: service.priceInPaisa,
      isAvailable: service.isAvailable,
      sortOrder: service.sortOrder,
      createdAt: service.createdAt.toISOString(),
    };
  }

  private async revalidateAfterWrite(businessId: string): Promise<void> {
    const business = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      include: {
        city: { select: { slug: true } },
        category: { select: { slug: true } },
      },
    });
    await this.revalidateService.revalidate({
      slug: business.slug,
      city: business.city.slug,
      category: business.category.slug,
    });
  }
}
