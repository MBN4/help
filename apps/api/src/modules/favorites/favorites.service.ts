import { Injectable } from '@nestjs/common';
import type { BusinessSummary, PaginationMeta } from '@buisnez/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { SearchService } from '../search/search.service';

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
  ) {}

  async toggle(
    userId: string,
    businessId: string,
  ): Promise<{ favorited: boolean }> {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, status: 'PUBLISHED' },
      select: { id: true },
    });
    if (!business) {
      throw new AppException(404, 'NOT_FOUND', 'Business not found');
    }

    const key = { userId_businessId: { userId, businessId } };
    const existing = await this.prisma.favorite.findUnique({ where: key });
    if (existing) {
      await this.prisma.favorite.delete({ where: key });
      return { favorited: false };
    }
    await this.prisma.favorite.create({ data: { userId, businessId } });
    return { favorited: true };
  }

  async listMine(
    userId: string,
    page: number,
    perPage: number,
  ): Promise<{ data: BusinessSummary[]; meta: PaginationMeta }> {
    const [total, favorites] = await Promise.all([
      this.prisma.favorite.count({ where: { userId } }),
      this.prisma.favorite.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        select: { businessId: true },
      }),
    ]);

    const data = await this.searchService.listByIds(
      favorites.map((favorite) => favorite.businessId),
    );
    return { data, meta: { page, perPage, total } };
  }

  async myFavoriteIds(userId: string): Promise<string[]> {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      select: { businessId: true },
    });
    return favorites.map((favorite) => favorite.businessId);
  }
}
