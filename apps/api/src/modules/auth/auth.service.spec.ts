import { hash, verify } from '@node-rs/argon2';
import { Role } from '@buisnez/database';
import { AppException } from '../../common/exceptions/app.exception';
import { AuthService } from './auth.service';

jest.mock('@node-rs/argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));

const mockedHash = hash as jest.MockedFunction<typeof hash>;
const mockedVerify = verify as jest.MockedFunction<typeof verify>;

function buildUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    email: 'zainab@example.com',
    name: 'Zainab Khan',
    role: Role.CUSTOMER,
    phone: null,
    passwordHash: 'hashed-password',
    avatarUrl: null,
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

async function captureError(action: () => Promise<unknown>): Promise<unknown> {
  try {
    await action();
    return undefined;
  } catch (error) {
    return error;
  }
}

describe('AuthService', () => {
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
    };
    emailVerificationToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    passwordResetToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let tokenService: {
    issueTokenPair: jest.Mock;
    verifyRefreshToken: jest.Mock;
    isRefreshTokenActive: jest.Mock;
    revokeRefreshToken: jest.Mock;
    revokeAllRefreshTokens: jest.Mock;
  };
  let mailService: {
    sendEmailVerification: jest.Mock;
    sendPasswordReset: jest.Mock;
  };
  let authService: AuthService;

  beforeEach(() => {
    mockedHash.mockReset();
    mockedVerify.mockReset();

    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      emailVerificationToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      passwordResetToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) =>
        Promise.all(ops),
      ),
    };
    tokenService = {
      issueTokenPair: jest.fn().mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        refreshTokenExpiresInSeconds: 2_592_000,
      }),
      verifyRefreshToken: jest.fn(),
      isRefreshTokenActive: jest.fn(),
      revokeRefreshToken: jest.fn(),
      revokeAllRefreshTokens: jest.fn(),
    };
    mailService = {
      sendEmailVerification: jest.fn(),
      sendPasswordReset: jest.fn(),
    };

    authService = new AuthService(
      prisma as never,
      tokenService as never,
      mailService as never,
    );
  });

  describe('register', () => {
    it('creates a user, hashes the password, and issues tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      mockedHash.mockResolvedValue('hashed-password');
      const created = buildUser();
      prisma.user.create.mockResolvedValue(created);

      const result = await authService.register({
        name: 'Zainab Khan',
        email: 'zainab@example.com',
        password: 'super-secret-1',
      });

      expect(mockedHash).toHaveBeenCalledWith('super-secret-1');
      expect(prisma.emailVerificationToken.create).toHaveBeenCalled();
      expect(mailService.sendEmailVerification).toHaveBeenCalledWith(
        created.email,
        expect.any(String),
      );
      expect(tokenService.issueTokenPair).toHaveBeenCalledWith(
        created.id,
        created.role,
      );
      expect(result.user.email).toBe(created.email);
      expect(result.accessToken).toBe('access-token');
    });

    it('rejects a duplicate email with 409 EMAIL_ALREADY_EXISTS', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());

      const error = await captureError(() =>
        authService.register({
          name: 'Zainab',
          email: 'zainab@example.com',
          password: 'super-secret-1',
        }),
      );

      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(409);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('issues tokens for correct credentials', async () => {
      const user = buildUser();
      prisma.user.findUnique.mockResolvedValue(user);
      mockedVerify.mockResolvedValue(true);

      const result = await authService.login({
        email: user.email,
        password: 'super-secret-1',
      });

      expect(mockedVerify).toHaveBeenCalledWith(
        user.passwordHash,
        'super-secret-1',
      );
      expect(tokenService.issueTokenPair).toHaveBeenCalledWith(
        user.id,
        user.role,
      );
      expect(result.accessToken).toBe('access-token');
    });

    it('rejects an unknown email with 401 INVALID_CREDENTIALS', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const error = await captureError(() =>
        authService.login({
          email: 'nobody@example.com',
          password: 'whatever',
        }),
      );

      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(401);
    });

    it('rejects a wrong password with 401 INVALID_CREDENTIALS', async () => {
      const user = buildUser();
      prisma.user.findUnique.mockResolvedValue(user);
      mockedVerify.mockResolvedValue(false);

      const error = await captureError(() =>
        authService.login({ email: user.email, password: 'wrong' }),
      );

      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(401);
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token when the presented jti is still active', async () => {
      tokenService.verifyRefreshToken.mockReturnValue({
        sub: 'user-1',
        jti: 'jti-1',
      });
      tokenService.isRefreshTokenActive.mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue(buildUser());

      await authService.refresh('some-refresh-token');

      expect(tokenService.revokeRefreshToken).toHaveBeenCalledWith(
        'user-1',
        'jti-1',
      );
      expect(tokenService.issueTokenPair).toHaveBeenCalledWith(
        'user-1',
        Role.CUSTOMER,
      );
      expect(tokenService.revokeAllRefreshTokens).not.toHaveBeenCalled();
    });

    it('treats an inactive jti as reuse and revokes every session', async () => {
      tokenService.verifyRefreshToken.mockReturnValue({
        sub: 'user-1',
        jti: 'jti-1',
      });
      tokenService.isRefreshTokenActive.mockResolvedValue(false);

      const error = await captureError(() =>
        authService.refresh('stolen-refresh-token'),
      );

      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(401);
      expect(tokenService.revokeAllRefreshTokens).toHaveBeenCalledWith(
        'user-1',
      );
    });

    it('rejects a token with an invalid signature', async () => {
      tokenService.verifyRefreshToken.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      const error = await captureError(() => authService.refresh('garbage'));

      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(401);
    });
  });

  describe('verifyEmail', () => {
    it('rejects an unknown or expired token', async () => {
      prisma.emailVerificationToken.findUnique.mockResolvedValue(null);

      const error = await captureError(() =>
        authService.verifyEmail('bad-token'),
      );

      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(400);
    });
  });
});
