import { Injectable } from '@nestjs/common';
import type { BusinessFeatureRef } from '@buisnez/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FeaturesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<BusinessFeatureRef[]> {
    const features = await this.prisma.feature.findMany({
      orderBy: { name: 'asc' },
    });
    return features.map((feature) => ({
      id: feature.id,
      name: feature.name,
      slug: feature.slug,
      icon: feature.icon,
    }));
  }
}
