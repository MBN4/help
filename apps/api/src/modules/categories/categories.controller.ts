import { Controller, Get, Param } from '@nestjs/common';
import type { CategoryDetail, CategoryNode } from '@buisnez/shared';
import { Public } from '../../common/decorators/public.decorator';
import { CategoriesService } from './categories.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  getTree(): Promise<CategoryNode[]> {
    return this.categoriesService.getTree();
  }

  @Public()
  @Get(':slug')
  getBySlug(@Param('slug') slug: string): Promise<CategoryDetail> {
    return this.categoriesService.getBySlug(slug);
  }
}
