import { ExecutionContext } from '@nestjs/common';
import { Role } from '@buisnez/database';
import { AppException } from '../exceptions/app.exception';
import { BusinessOwnerGuard } from './business-owner.guard';

function buildContext(
  user: { id: string; role: Role } | undefined,
  businessId: string,
): ExecutionContext {
  const request = { user, params: { businessId } };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
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

describe('BusinessOwnerGuard', () => {
  let prisma: { business: { findUnique: jest.Mock } };
  let guard: BusinessOwnerGuard;

  beforeEach(() => {
    prisma = { business: { findUnique: jest.fn() } };
    guard = new BusinessOwnerGuard(prisma as never);
  });

  it('allows the business owner', async () => {
    prisma.business.findUnique.mockResolvedValue({ ownerId: 'owner-1' });
    const context = buildContext(
      { id: 'owner-1', role: Role.CUSTOMER },
      'business-1',
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('allows an ADMIN even when they do not own the business', async () => {
    prisma.business.findUnique.mockResolvedValue({ ownerId: 'owner-1' });
    const context = buildContext(
      { id: 'admin-1', role: Role.ADMIN },
      'business-1',
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects a different authenticated non-owner user with 403', async () => {
    prisma.business.findUnique.mockResolvedValue({ ownerId: 'owner-1' });
    const context = buildContext(
      { id: 'someone-else', role: Role.CUSTOMER },
      'business-1',
    );

    const error = await captureError(() => guard.canActivate(context));
    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).getStatus()).toBe(403);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const context = buildContext(undefined, 'business-1');

    const error = await captureError(() => guard.canActivate(context));
    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).getStatus()).toBe(401);
    expect(prisma.business.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a missing business with 404', async () => {
    prisma.business.findUnique.mockResolvedValue(null);
    const context = buildContext(
      { id: 'owner-1', role: Role.CUSTOMER },
      'missing-business',
    );

    const error = await captureError(() => guard.canActivate(context));
    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).getStatus()).toBe(404);
  });
});
