import { Module } from '@nestjs/common';
import { GeoModule } from '../geo/geo.module';
import { SearchModule } from '../search/search.module';
import { PhotosModule } from '../photos/photos.module';
import { RevalidateModule } from '../../integrations/revalidate/revalidate.module';
import { EditSuggestionsModule } from '../edit-suggestions/edit-suggestions.module';
import { BusinessOwnerController } from './business-owner.controller';
import { BusinessOwnerService } from './business-owner.service';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';

@Module({
  imports: [
    GeoModule,
    SearchModule,
    PhotosModule,
    RevalidateModule,
    EditSuggestionsModule,
  ],
  // BusinessOwnerController first: its static `owned/mine` route must be matched before
  // BusinessesController's `@Get(':slug')` catch-all (Nest/Express match in registration order).
  controllers: [BusinessOwnerController, BusinessesController],
  providers: [BusinessesService, BusinessOwnerService],
})
export class BusinessesModule {}
