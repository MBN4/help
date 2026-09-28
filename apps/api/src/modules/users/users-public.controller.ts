import { Controller, Get, Param } from '@nestjs/common';
import type { PublicUserProfile } from '@buisnez/shared';
import { Public } from '../../common/decorators/public.decorator';
import { UsersService } from './users.service';

/** Separate from `UsersController` (`users/me`, always authenticated) since this route is public and keyed
 * by an arbitrary user id, not the caller. */
@Controller('users')
export class UsersPublicController {
  constructor(private readonly usersService: UsersService) {}

  @Public()
  @Get(':userId/public-profile')
  publicProfile(@Param('userId') userId: string): Promise<PublicUserProfile> {
    return this.usersService.publicProfile(userId);
  }
}
