import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@buisnez/database';
import type { Request } from 'express';

export interface RequestUser {
  id: string;
  role: Role;
}

export const CurrentUser = createParamDecorator(
  (
    field: keyof RequestUser | undefined,
    ctx: ExecutionContext,
  ): RequestUser | RequestUser[keyof RequestUser] => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: RequestUser }>();
    return field ? request.user[field] : request.user;
  },
);
