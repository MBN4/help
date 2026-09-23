import { Role } from '@buisnez/database';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  jti: string;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresInSeconds: number;
}
