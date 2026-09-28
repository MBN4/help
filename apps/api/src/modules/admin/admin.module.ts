import { Module } from '@nestjs/common';
import { GeoModule } from '../geo/geo.module';
import { DiscoveryModule } from '../discovery/discovery.module';
import { ModerationModule } from '../../integrations/moderation/moderation.module';
import { RevalidateModule } from '../../integrations/revalidate/revalidate.module';
import { MailModule } from '../../integrations/mail/mail.module';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminReportsController } from './admin-reports.controller';
import { AdminReportsService } from './admin-reports.service';
import { AdminContentController } from './admin-content.controller';
import { AdminContentService } from './admin-content.service';
import { AdminBusinessesController } from './admin-businesses.controller';
import { AdminBusinessesService } from './admin-businesses.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminTaxonomyController } from './admin-taxonomy.controller';
import { AdminTaxonomyService } from './admin-taxonomy.service';
import { AdminModerationLogController } from './admin-moderation-log.controller';
import { AdminEditSuggestionsController } from './admin-edit-suggestions.controller';
import { EditSuggestionsModule } from '../edit-suggestions/edit-suggestions.module';

@Module({
  imports: [
    GeoModule,
    DiscoveryModule,
    ModerationModule,
    RevalidateModule,
    MailModule,
    AuthModule,
    EditSuggestionsModule,
  ],
  controllers: [
    AdminController,
    AdminDashboardController,
    AdminReportsController,
    AdminContentController,
    AdminBusinessesController,
    AdminUsersController,
    AdminTaxonomyController,
    AdminModerationLogController,
    AdminEditSuggestionsController,
  ],
  providers: [
    AdminDashboardService,
    AdminContentService,
    AdminReportsService,
    AdminBusinessesService,
    AdminUsersService,
    AdminTaxonomyService,
  ],
})
export class AdminModule {}
