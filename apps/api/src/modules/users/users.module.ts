import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersPublicController } from './users-public.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController, UsersPublicController],
  providers: [UsersService],
})
export class UsersModule {}
