import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../exceptions/app.exception';
import { JwtAuthGuard } from './jwt-auth.guard';

function buildContext(cookies: Record<string, string>): ExecutionContext {
  const request = { cookies, headers: {} };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

async function captureError(action: () => Promise<unknown>): Promise<unknown> {
  try {
    await action();
    return undefined;
  } catch (error) {
    return error;
  }
}

describe('JwtAuthGuard', () => {
  let jwtService: { verify: jest.Mock };
  let config: { get: jest.Mock };
  let tokenService: { isBanned: jest.Mock };
  let reflector: Reflector;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jwtService = { verify: jest.fn() };
    config = { get: jest.fn().mockReturnValue('secret') };
    tokenService = { isBanned: jest.fn() };
    reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    guard = new JwtAuthGuard(
      reflector,
      jwtService as never,
      config as never,
      tokenService as never,
    );
  });

  it('allows a valid, non-banned token through', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1', role: 'CUSTOMER' });
    tokenService.isBanned.mockResolvedValue(false);
    const context = buildContext({ access_token: 'valid-token' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects an otherwise-valid, not-yet-expired token for a banned user', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1', role: 'CUSTOMER' });
    tokenService.isBanned.mockResolvedValue(true);
    const context = buildContext({ access_token: 'valid-token' });

    const error = await captureError(() => guard.canActivate(context));
    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).getStatus()).toBe(401);
    expect(
      (error as AppException).getResponse() as { code: string },
    ).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects an invalid token before even checking the ban flag', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('bad token');
    });
    const context = buildContext({ access_token: 'garbage' });

    const error = await captureError(() => guard.canActivate(context));
    expect(error).toBeInstanceOf(AppException);
    expect(tokenService.isBanned).not.toHaveBeenCalled();
  });
});
