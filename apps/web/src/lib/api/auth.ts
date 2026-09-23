import { z } from 'zod';
import {
  authResponseSchema,
  authUserSchema,
  refreshResponseSchema,
  type ForgotPasswordRequest,
  type LoginRequest,
  type RegisterRequest,
  type ResetPasswordRequest,
  type UpdateProfileRequest,
  type VerifyEmailRequest,
} from '@buisnez/shared';
import { apiRequest } from './client';

export async function register(body: RegisterRequest) {
  return apiRequest('/auth/register', authResponseSchema, {
    method: 'POST',
    body,
  });
}

export async function login(body: LoginRequest) {
  return apiRequest('/auth/login', authResponseSchema, {
    method: 'POST',
    body,
  });
}

export async function logout() {
  return apiRequest('/auth/logout', z.object({ loggedOut: z.literal(true) }), {
    method: 'POST',
  });
}

export async function getMe() {
  return apiRequest('/auth/me', authUserSchema);
}

export async function refresh() {
  return apiRequest('/auth/refresh', refreshResponseSchema, {
    method: 'POST',
    skipAuthRetry: true,
  });
}

export async function verifyEmail(body: VerifyEmailRequest) {
  return apiRequest(
    '/auth/verify-email',
    z.object({ verified: z.literal(true) }),
    { method: 'POST', body },
  );
}

export async function forgotPassword(body: ForgotPasswordRequest) {
  return apiRequest(
    '/auth/forgot-password',
    z.object({ sent: z.literal(true) }),
    { method: 'POST', body },
  );
}

export async function resetPassword(body: ResetPasswordRequest) {
  return apiRequest(
    '/auth/reset-password',
    z.object({ reset: z.literal(true) }),
    { method: 'POST', body },
  );
}

export async function updateProfile(body: UpdateProfileRequest) {
  return apiRequest('/users/me', authUserSchema, { method: 'PATCH', body });
}
