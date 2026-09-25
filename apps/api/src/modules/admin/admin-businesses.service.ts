import { Injectable } from '@nestjs/common';
import type {
  CreateAdminBusinessRequest,
  ListAdminBusinessesQuery,
  UpdateAdminBusinessRequest,
  UpdateBusinessFeaturedRequest,
  UpdateBusinessStatusRequest,
} from '@buisnez/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { GeoService } from '../geo/geo.service';
import { RevalidateService } from '../../integrations/revalidate/revalidate.service';
import { DiscoveryService } from '../discovery/discovery.service';
import {
  ModerationLogService,
  MODERATION_ACTIONS,
} from '../../integrations/moderation/moderation-log.service';

@Injectable()
export class AdminBusinessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geoService: GeoService,
    private readonly revalidateService: RevalidateService,
    private readonly discoveryService: DiscoveryService,
    private readonly moderationLog: ModerationLogService,
  ) {}

  async list(query: ListAdminBusinessesQuery) {
    const where = {
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? { name: { contains: query.q, mode: 'insensitive' as const } }
        : {}),
    };
    const [total, data] = await Promise.all([
      this.prisma.business.count({ where }),
      this.prisma.business.findMany({
        where,
        include: {
          category: { select: { name: true, slug: true } },
          city: { select: { name: true, slug: true } },
          owner: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
    ]);
    return { data, meta: { page: query.page, perPage: query.perPage, total } };
  }

  async getById(id: string) {
    const business = await this.prisma.business.findUnique({
      where: { id },
      include: {
        category: true,
        province: true,
        city: true,
        area: true,
        owner: { select: { id: true, name: true, email: true } },
        hours: true,
        features: { include: { feature: true } },
      },
    });
    if (!business) {
      throw new AppException(404, 'NOT_FOUND', 'Business not found');
    }
    const location = await this.geoService.getBusinessLocation(id);
    return { ...business, location };
  }

  async updateStatus(
    id: string,
    actorId: string,
    input: UpdateBusinessStatusRequest,
  ) {
    const business = await this.assertExists(id);
    await this.prisma.business.update({
      where: { id },
      data: { status: input.status },
    });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.BUSINESS_STATUS_CHANGED,
      targetType: 'BUSINESS',
      targetId: id,
      reason: input.reason ?? null,
      metadata: { fromStatus: business.status, toStatus: input.status },
    });
    await this.revalidate(business);
    return this.getById(id);
  }

  async updateVerify(id: string, actorId: string, isVerified: boolean) {
    const business = await this.assertExists(id);
    await this.prisma.business.update({ where: { id }, data: { isVerified } });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.BUSINESS_VERIFIED_TOGGLED,
      targetType: 'BUSINESS',
      targetId: id,
      metadata: { isVerified },
    });
    await this.revalidate(business);
    return this.getById(id);
  }

  async updateFeatured(
    id: string,
    actorId: string,
    input: UpdateBusinessFeaturedRequest,
  ) {
    const business = await this.assertExists(id);
    await this.prisma.business.update({
      where: { id },
      data: {
        featured: input.featured,
        featuredFrom:
          input.featuredFrom === undefined
            ? undefined
            : input.featuredFrom
              ? new Date(input.featuredFrom)
              : null,
        featuredUntil:
          input.featuredUntil === undefined
            ? undefined
            : input.featuredUntil
              ? new Date(input.featuredUntil)
              : null,
      },
    });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.BUSINESS_FEATURED_TOGGLED,
      targetType: 'BUSINESS',
      targetId: id,
      metadata: input,
    });
    await this.discoveryService.invalidateHomeCache();
    await this.revalidate(business);
    return this.getById(id);
  }

  async create(actorId: string, input: CreateAdminBusinessRequest) {
    const slug = await this.uniqueSlug(input.name);
    const business = await this.prisma.business.create({
      data: {
        name: input.name,
        slug,
        description: input.description ?? null,
        categoryId: input.categoryId,
        provinceId: input.provinceId,
        cityId: input.cityId,
        areaId: input.areaId ?? null,
        addressLine: input.addressLine,
        phone: input.phone ?? null,
        whatsapp: input.whatsapp ?? null,
        email: input.email ?? null,
        website: input.website ?? null,
        ownerId: input.ownerId ?? null,
      },
    });
    if (input.location) {
      await this.geoService.setBusinessLocation(
        business.id,
        input.location.lat,
        input.location.lng,
      );
    }
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.BUSINESS_CREATED,
      targetType: 'BUSINESS',
      targetId: business.id,
    });
    return this.getById(business.id);
  }

  async update(id: string, actorId: string, input: UpdateAdminBusinessRequest) {
    const business = await this.assertExists(id);
    await this.prisma.business.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.categoryId !== undefined
          ? { categoryId: input.categoryId }
          : {}),
        ...(input.provinceId !== undefined
          ? { provinceId: input.provinceId }
          : {}),
        ...(input.cityId !== undefined ? { cityId: input.cityId } : {}),
        ...(input.areaId !== undefined ? { areaId: input.areaId } : {}),
        ...(input.addressLine !== undefined
          ? { addressLine: input.addressLine }
          : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.whatsapp !== undefined ? { whatsapp: input.whatsapp } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.website !== undefined ? { website: input.website } : {}),
        ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
      },
    });
    if (input.location) {
      await this.geoService.setBusinessLocation(
        id,
        input.location.lat,
        input.location.lng,
      );
    }
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.BUSINESS_UPDATED,
      targetType: 'BUSINESS',
      targetId: id,
      metadata: input,
    });
    await this.revalidate(business);
    return this.getById(id);
  }

  async softDelete(id: string, actorId: string) {
    const business = await this.assertExists(id);
    await this.prisma.business.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.BUSINESS_SOFT_DELETED,
      targetType: 'BUSINESS',
      targetId: id,
    });
    await this.revalidate(business);
    return this.getById(id);
  }

  async restore(id: string, actorId: string) {
    const business = await this.assertExists(id);
    await this.prisma.business.update({
      where: { id },
      data: { deletedAt: null },
    });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.BUSINESS_RESTORED,
      targetType: 'BUSINESS',
      targetId: id,
    });
    await this.revalidate(business);
    return this.getById(id);
  }

  private async assertExists(id: string) {
    const business = await this.prisma.business.findUnique({
      where: { id },
      include: {
        city: { select: { slug: true } },
        category: { select: { slug: true } },
      },
    });
    if (!business) {
      throw new AppException(404, 'NOT_FOUND', 'Business not found');
    }
    return business;
  }

  private async revalidate(business: {
    slug: string;
    city: { slug: string };
    category: { slug: string };
  }): Promise<void> {
    await this.revalidateService.revalidate({
      slug: business.slug,
      city: business.city.slug,
      category: business.category.slug,
    });
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    let slug = base;
    let suffix = 1;
    for (;;) {
      const existing = await this.prisma.business.findUnique({
        where: { slug },
      });
      if (!existing) return slug;
      suffix += 1;
      slug = `${base}-${suffix}`;
    }
  }
}
