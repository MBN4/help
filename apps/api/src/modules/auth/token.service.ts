import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@buisnez/database';
import type { Redis } from 'ioredis';
import { Env } from '../../config/env.schema';
import { REDIS_CLIENT } from '../../integrations/redis/redis.constants';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
  TokenPair,
} from './token.types';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<Env, true>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async issueTokenPair(userId: string, role: Role): Promise<TokenPair> {
    const accessPayload: AccessTokenPayload = {
      sub: userId,
      role,
      jti: randomUUID(),
    };
    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.config.get('JWT_SECRET', { infer: true }),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });

    const refreshJti = randomUUID();
    const refreshPayload: RefreshTokenPayload = {
      sub: userId,
      jti: refreshJti,
    };
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      expiresIn: REFRESH_TOKEN_TTL_SECONDS,
    });

    await this.redis.set(
      this.refreshKey(userId, refreshJti),
      '1',
      'EX',
      REFRESH_TOKEN_TTL_SECONDS,
    );

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresInSeconds: REFRESH_TOKEN_TTL_SECONDS,
    };
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    return this.jwtService.verify<RefreshTokenPayload>(token, {
      secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
    });
  }

  async isRefreshTokenActive(userId: string, jti: string): Promise<boolean> {
    const exists = await this.redis.exists(this.refreshKey(userId, jti));
    return exists === 1;
  }

  async revokeRefreshToken(userId: string, jti: string): Promise<void> {
    await this.redis.del(this.refreshKey(userId, jti));
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    const keys = await this.redis.keys(`refresh:${userId}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  private refreshKey(userId: string, jti: string): string {
    return `refresh:${userId}:${jti}`;
  }
}
