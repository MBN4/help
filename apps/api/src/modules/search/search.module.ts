import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { GeoModule } from '../geo/geo.module';
import { SearchService } from './search.service';

@Module({
  imports: [GeoModule, CategoriesModule],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
