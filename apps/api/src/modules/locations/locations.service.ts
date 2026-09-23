import { Injectable } from '@nestjs/common';
import type {
  AreaSummary,
  CityDetail,
  CitySummary,
  ProvinceSummary,
} from '@buisnez/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { GeoService } from '../geo/geo.service';

@Injectable()
export class LocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geoService: GeoService,
  ) {}

  async getProvinces(): Promise<ProvinceSummary[]> {
    const provinces = await this.prisma.province.findMany({
      include: { _count: { select: { cities: true } } },
      orderBy: { name: 'asc' },
    });
    return provinces.map((province) => ({
      id: province.id,
      name: province.name,
      slug: province.slug,
      cityCount: province._count.cities,
    }));
  }

  async getCities(provinceSlug?: string): Promise<CitySummary[]> {
    const cities = await this.prisma.city.findMany({
      where: provinceSlug ? { province: { slug: provinceSlug } } : undefined,
      include: { province: true },
      orderBy: { name: 'asc' },
    });
    return cities.map((city) => ({
      id: city.id,
      name: city.name,
      slug: city.slug,
      provinceName: city.province.name,
    }));
  }

  async getCityBySlug(slug: string): Promise<CityDetail> {
    const city = await this.prisma.city.findUnique({
      where: { slug },
      include: { province: true },
    });
    if (!city) {
      throw new AppException(404, 'NOT_FOUND', 'City not found');
    }
    return {
      id: city.id,
      name: city.name,
      slug: city.slug,
      provinceName: city.province.name,
      centroid: await this.geoService.getCityCentroid(city.id),
    };
  }

  async getAreas(citySlug: string): Promise<AreaSummary[]> {
    const city = await this.prisma.city.findUnique({
      where: { slug: citySlug },
    });
    if (!city) {
      throw new AppException(404, 'NOT_FOUND', 'City not found');
    }
    const areas = await this.prisma.area.findMany({
      where: { cityId: city.id },
      orderBy: { name: 'asc' },
    });
    return areas.map((area) => ({
      id: area.id,
      name: area.name,
      slug: area.slug,
    }));
  }
}
