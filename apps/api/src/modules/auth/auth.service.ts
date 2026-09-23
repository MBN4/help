import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { User } from '@buisnez/database';
import { AuthUser, LoginRequest, RegisterRequest } from '@buisnez/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../integrations/mail/mail.service';
import { AppException } from '../../common/exceptions/app.exception';
import { TokenService } from './token.service';
import { TokenPair } from './token.types';
import {
  generateVerificationToken,
  hashToken,
} from './verification-token.util';

export interface AuthResult extends TokenPair {
  user: AuthUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly mailService: MailService,
  ) {}

  async register(input: RegisterRequest): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw new AppException(
        409,
        'EMAIL_ALREADY_EXISTS',
        'An account with this email already exists',
      );
    }

    const passwordHash = await hash(input.password);
    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash,
      },
    });

    const { raw, hash: tokenHash } = generateVerificationToken();
    await this.prisma.emailVerificationToken.create({
      data: { userId: user.id, tokenHash, expiresAt: addHours(24) },
    });
    this.mailService.sendEmailVerification(user.email, raw);

    const tokens = await this.tokenService.issueTokenPair(user.id, user.role);
    return { user: serializeUser(user), ...tokens };
  }

  async login(input: LoginRequest): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (
      !user ||
      !user.passwordHash ||
      !(await verify(user.passwordHash, input.password))
    ) {
      throw new AppException(
        401,
        'INVALID_CREDENTIALS',
        'Invalid email or password',
      );
    }

    const tokens = await this.tokenService.issueTokenPair(user.id, user.role);
    return { user: serializeUser(user), ...tokens };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const payload = this.verifyRefreshTokenOrThrow(refreshToken);

    const isActive = await this.tokenService.isRefreshTokenActive(
      payload.sub,
      payload.jti,
    );
    if (!isActive) {
      // The jti was already consumed or never issued: assume compromise and kill every session.
      await this.tokenService.revokeAllRefreshTokens(payload.sub);
      throw new AppException(
        401,
        'UNAUTHORIZED',
        'Refresh token has already been used',
      );
    }
    await this.tokenService.revokeRefreshToken(payload.sub, payload.jti);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new AppException(401, 'UNAUTHORIZED', 'User no longer exists');
    }

    return this.tokenService.issueTokenPair(user.id, user.role);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }
    try {
      const payload = this.tokenService.verifyRefreshToken(refreshToken);
      await this.tokenService.revokeRefreshToken(payload.sub, payload.jti);
    } catch {
      // Already invalid/expired: nothing to revoke.
    }
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return serializeUser(user);
  }

  async verifyEmail(token: string): Promise<void> {
    const tokenHash = hashToken(token);
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new AppException(
        400,
        'INVALID_TOKEN',
        'Verification link is invalid or has expired',
      );
    }

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return; // Always 200 upstream: no account enumeration.
    }

    const { raw, hash: tokenHash } = generateVerificationToken();
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: addHours(1) },
    });
    this.mailService.sendPasswordReset(user.email, raw);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(token);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new AppException(
        400,
        'INVALID_TOKEN',
        'Reset link is invalid or has expired',
      );
    }

    const passwordHash = await hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
    ]);
    await this.tokenService.revokeAllRefreshTokens(record.userId);
  }

  private verifyRefreshTokenOrThrow(refreshToken: string): {
    sub: string;
    jti: string;
  } {
    try {
      return this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new AppException(
        401,
        'UNAUTHORIZED',
        'Invalid or expired refresh token',
      );
    }
  }
}

export function serializeUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt
      ? user.emailVerifiedAt.toISOString()
      : null,
    hasPassword: user.passwordHash !== null,
  };
}

function addHours(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
