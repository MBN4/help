import { Injectable } from '@nestjs/common';
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
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { GeoService } from '../geo/geo.service';
import {
  ModerationLogService,
  MODERATION_ACTIONS,
} from '../../integrations/moderation/moderation-log.service';

@Injectable()
export class AdminTaxonomyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geoService: GeoService,
    private readonly moderationLog: ModerationLogService,
  ) {}

  // --- Categories --------------------------------------------------------

  async createCategory(actorId: string, input: CreateCategoryRequest) {
    const category = await this.prisma.category.create({
      data: {
        name: input.name,
        slug: input.slug,
        icon: input.icon ?? null,
        parentId: input.parentId ?? null,
        order: input.order ?? 0,
      },
    });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.CATEGORY_CREATED,
      targetType: 'CATEGORY',
      targetId: category.id,
      metadata: { kind: 'category' },
    });
    return category;
  }

  async updateCategory(
    id: string,
    actorId: string,
    input: UpdateCategoryRequest,
  ) {
    await this.assertExists(this.prisma.category, id, 'Category');
    const category = await this.prisma.category.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
        ...(input.order !== undefined ? { order: input.order } : {}),
      },
    });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.CATEGORY_UPDATED,
      targetType: 'CATEGORY',
      targetId: id,
      metadata: { kind: 'category' },
    });
    return category;
  }

  async deleteCategory(id: string, actorId: string): Promise<void> {
    const [childCount, businessCount] = await Promise.all([
      this.prisma.category.count({ where: { parentId: id } }),
      this.prisma.business.count({ where: { categoryId: id } }),
    ]);
    if (childCount > 0) {
      throw new AppException(
        409,
        'CATEGORY_HAS_CHILDREN',
        'Category has child categories',
      );
    }
    if (businessCount > 0) {
      throw new AppException(
        409,
        'CATEGORY_IN_USE',
        'Category has businesses referencing it',
      );
    }
    await this.prisma.category.delete({ where: { id } });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.CATEGORY_DELETED,
      targetType: 'CATEGORY',
      targetId: id,
      metadata: { kind: 'category' },
    });
  }

  // --- Provinces -----------------------------------------------------------

  async createProvince(actorId: string, input: CreateProvinceRequest) {
    const province = await this.prisma.province.create({ data: input });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.PROVINCE_CREATED,
      targetType: 'CATEGORY',
      targetId: province.id,
      metadata: { kind: 'province' },
    });
    return province;
  }

  async updateProvince(
    id: string,
    actorId: string,
    input: UpdateProvinceRequest,
  ) {
    await this.assertExists(this.prisma.province, id, 'Province');
    const province = await this.prisma.province.update({
      where: { id },
      data: input,
    });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.PROVINCE_UPDATED,
      targetType: 'CATEGORY',
      targetId: id,
      metadata: { kind: 'province' },
    });
    return province;
  }

  async deleteProvince(id: string, actorId: string): Promise<void> {
    const cityCount = await this.prisma.city.count({
      where: { provinceId: id },
    });
    if (cityCount > 0) {
      throw new AppException(409, 'PROVINCE_IN_USE', 'Province has cities');
    }
    await this.prisma.province.delete({ where: { id } });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.PROVINCE_DELETED,
      targetType: 'CATEGORY',
      targetId: id,
      metadata: { kind: 'province' },
    });
  }

  // --- Cities ----------------------------------------------------------

  async createCity(actorId: string, input: CreateCityRequest) {
    const city = await this.prisma.city.create({
      data: {
        name: input.name,
        slug: input.slug,
        provinceId: input.provinceId,
      },
    });
    if (input.centroid) {
      await this.geoService.setCityCentroid(
        city.id,
        input.centroid.lat,
        input.centroid.lng,
      );
    }
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.CITY_CREATED,
      targetType: 'CATEGORY',
      targetId: city.id,
      metadata: { kind: 'city' },
    });
    return city;
  }

  async updateCity(id: string, actorId: string, input: UpdateCityRequest) {
    await this.assertExists(this.prisma.city, id, 'City');
    const city = await this.prisma.city.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.provinceId !== undefined
          ? { provinceId: input.provinceId }
          : {}),
      },
    });
    if (input.centroid !== undefined && input.centroid !== null) {
      await this.geoService.setCityCentroid(
        id,
        input.centroid.lat,
        input.centroid.lng,
      );
    }
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.CITY_UPDATED,
      targetType: 'CATEGORY',
      targetId: id,
      metadata: { kind: 'city' },
    });
    return city;
  }

  async deleteCity(id: string, actorId: string): Promise<void> {
    const [businessCount, areaCount] = await Promise.all([
      this.prisma.business.count({ where: { cityId: id } }),
      this.prisma.area.count({ where: { cityId: id } }),
    ]);
    if (businessCount > 0 || areaCount > 0) {
      throw new AppException(
        409,
        'CITY_IN_USE',
        'City has businesses or areas',
      );
    }
    await this.prisma.city.delete({ where: { id } });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.CITY_DELETED,
      targetType: 'CATEGORY',
      targetId: id,
      metadata: { kind: 'city' },
    });
  }

  // --- Areas -------------------------------------------------------------

  async createArea(actorId: string, input: CreateAreaRequest) {
    const area = await this.prisma.area.create({ data: input });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.AREA_CREATED,
      targetType: 'CATEGORY',
      targetId: area.id,
      metadata: { kind: 'area' },
    });
    return area;
  }

  async updateArea(id: string, actorId: string, input: UpdateAreaRequest) {
    await this.assertExists(this.prisma.area, id, 'Area');
    const area = await this.prisma.area.update({ where: { id }, data: input });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.AREA_UPDATED,
      targetType: 'CATEGORY',
      targetId: id,
      metadata: { kind: 'area' },
    });
    return area;
  }

  async deleteArea(id: string, actorId: string): Promise<void> {
    const businessCount = await this.prisma.business.count({
      where: { areaId: id },
    });
    if (businessCount > 0) {
      throw new AppException(
        409,
        'AREA_IN_USE',
        'Area has businesses referencing it',
      );
    }
    await this.prisma.area.delete({ where: { id } });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.AREA_DELETED,
      targetType: 'CATEGORY',
      targetId: id,
      metadata: { kind: 'area' },
    });
  }

  // --- Features ------------------------------------------------------------

  async createFeature(actorId: string, input: CreateFeatureRequest) {
    const feature = await this.prisma.feature.create({
      data: { name: input.name, slug: input.slug, icon: input.icon ?? null },
    });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.FEATURE_CREATED,
      targetType: 'CATEGORY',
      targetId: feature.id,
      metadata: { kind: 'feature' },
    });
    return feature;
  }

  async updateFeature(
    id: string,
    actorId: string,
    input: UpdateFeatureRequest,
  ) {
    await this.assertExists(this.prisma.feature, id, 'Feature');
    const feature = await this.prisma.feature.update({
      where: { id },
      data: input,
    });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.FEATURE_UPDATED,
      targetType: 'CATEGORY',
      targetId: id,
      metadata: { kind: 'feature' },
    });
    return feature;
  }

  async deleteFeature(id: string, actorId: string): Promise<void> {
    await this.assertExists(this.prisma.feature, id, 'Feature');
    await this.prisma.feature.delete({ where: { id } });
    await this.moderationLog.record({
      actorId,
      action: MODERATION_ACTIONS.FEATURE_DELETED,
      targetType: 'CATEGORY',
      targetId: id,
      metadata: { kind: 'feature' },
    });
  }

  private async assertExists(
    model: {
      findUnique: (args: { where: { id: string } }) => Promise<unknown>;
    },
    id: string,
    label: string,
  ): Promise<void> {
    const row = await model.findUnique({ where: { id } });
    if (!row) {
      throw new AppException(404, 'NOT_FOUND', `${label} not found`);
    }
  }
}
