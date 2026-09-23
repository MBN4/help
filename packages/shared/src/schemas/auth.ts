import { z } from 'zod';
import { roleSchema } from '../enums';

export const pkPhoneSchema = z
  .string()
  .regex(/^\+92\d{10}$/, 'Phone must be in +92XXXXXXXXXX format');

export const registerRequestSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  phone: pkPhoneSchema.optional(),
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: roleSchema,
  emailVerifiedAt: z.string().datetime().nullable(),
  hasPassword: z.boolean(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const updateProfileRequestSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  bio: z.string().max(500).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
});
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

// register/login response: both tokens are set as httpOnly cookies (see docs/10-auth-roles.md) — never in the body.
export const authResponseSchema = z.object({
  user: authUserSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const refreshResponseSchema = z.object({
  refreshed: z.literal(true),
});
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;

export const verifyEmailRequestSchema = z.object({
  token: z.string().min(1),
});
export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;

export const forgotPasswordRequestSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;

export const resetPasswordRequestSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
