import type { Response } from 'express';

export const ACCESS_COOKIE_NAME = 'access_token';
export const ACCESS_COOKIE_PATH = '/';
export const REFRESH_COOKIE_NAME = 'refresh_token';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export function setAuthCookies(
  res: Response,
  secure: boolean,
  accessToken: string,
  refreshToken: string,
  refreshMaxAgeSeconds: number,
): void {
  res.cookie(ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: ACCESS_COOKIE_PATH,
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: refreshMaxAgeSeconds * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE_NAME, { path: ACCESS_COOKIE_PATH });
  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
}
