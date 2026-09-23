import { Injectable } from '@nestjs/common';
import type { CategoryDetail, CategoryNode } from '@buisnez/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import {
  buildCategoryTree,
  buildChildrenMap,
  collectDescendantCategoryIds,
} from './category-tree.util';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async getTree(): Promise<CategoryNode[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: { order: 'asc' },
    });
    const childrenMap = buildChildrenMap(rows);
    return buildCategoryTree(null, childrenMap);
  }

  async getBySlug(slug: string): Promise<CategoryDetail> {
    const rows = await this.prisma.category.findMany({
      orderBy: { order: 'asc' },
    });
    const target = rows.find((row) => row.slug === slug);
    if (!target) {
      throw new AppException(404, 'NOT_FOUND', 'Category not found');
    }

    const childrenMap = buildChildrenMap(rows);
    const parent = target.parentId
      ? (rows.find((row) => row.id === target.parentId) ?? null)
      : null;
    const children = childrenMap.get(target.id) ?? [];

    return {
      id: target.id,
      name: target.name,
      slug: target.slug,
      icon: target.icon,
      parent: parent
        ? { id: parent.id, name: parent.name, slug: parent.slug }
        : null,
      children: children.map((child) => ({
        id: child.id,
        name: child.name,
        slug: child.slug,
      })),
      descendantCategoryIds: collectDescendantCategoryIds(
        target.id,
        childrenMap,
      ),
    };
  }

  /** Used by `SearchService` to resolve `category=<slug>` into `categoryId IN (...)`. */
  async resolveDescendantCategoryIdsBySlug(
    slug: string,
  ): Promise<string[] | null> {
    const rows = await this.prisma.category.findMany();
    const target = rows.find((row) => row.slug === slug);
    if (!target) {
      return null;
    }
    return collectDescendantCategoryIds(target.id, buildChildrenMap(rows));
  }
}
