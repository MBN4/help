import { SetMetadata } from '@nestjs/common';
import { Role } from '@buisnez/database';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
