import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { ImageProcessingService } from './image-processing.service';

@Module({
  providers: [StorageService, ImageProcessingService],
  exports: [StorageService, ImageProcessingService],
})
export class StorageModule {}
