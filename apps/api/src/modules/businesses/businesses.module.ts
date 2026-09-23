import { Module } from '@nestjs/common';
import { GeoModule } from '../geo/geo.module';
import { SearchModule } from '../search/search.module';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';

@Module({
  imports: [GeoModule, SearchModule],
  controllers: [BusinessesController],
  providers: [BusinessesService],
})
export class BusinessesModule {}
