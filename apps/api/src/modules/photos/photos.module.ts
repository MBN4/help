import { Module } from '@nestjs/common';
import { StorageModule } from '../../integrations/storage/storage.module';
import { ModerationModule } from '../../integrations/moderation/moderation.module';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';

@Module({
  imports: [StorageModule, ModerationModule],
  controllers: [PhotosController],
  providers: [PhotosService],
})
export class PhotosModule {}
