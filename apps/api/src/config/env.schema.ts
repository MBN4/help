import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  WEB_ORIGIN: z.string().min(1).default('http://localhost:3000'),
  GOOGLE_MAPS_API_KEY: z.string().optional().default(''),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional().default(''),
  FACEBOOK_OAUTH_CLIENT_ID: z.string().optional().default(''),
  FACEBOOK_OAUTH_CLIENT_SECRET: z.string().optional().default(''),
  OAUTH_CALLBACK_BASE_URL: z
    .string()
    .min(1)
    .default('http://localhost:4000/api/v1'),
  S3_ENDPOINT: z.string().min(1).default('http://localhost:9102'),
  S3_REGION: z.string().min(1).default('auto'),
  S3_ACCESS_KEY_ID: z.string().min(1).default('buisnez'),
  S3_SECRET_ACCESS_KEY: z.string().min(1).default('buisnez-dev-password'),
  S3_BUCKET: z.string().min(1).default('buisnez-photos'),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  S3_PUBLIC_URL_BASE: z
    .string()
    .min(1)
    .default('http://localhost:9102/buisnez-photos'),
  REVALIDATE_SECRET: z.string().optional().default(''),
  WEB_REVALIDATE_URL: z
    .string()
    .min(1)
    .default('http://localhost:3000/api/revalidate'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Invalid environment configuration: ${result.error.message}`,
    );
  }
  return result.data;
}
