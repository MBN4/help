import { Controller, Get } from '@nestjs/common';
import { Role } from '@buisnez/database';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('admin')
export class AdminController {
  @Roles(Role.ADMIN)
  @Get('ping')
  ping(): { pong: true } {
    return { pong: true };
  }
}
