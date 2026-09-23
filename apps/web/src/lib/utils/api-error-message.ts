import { ApiError } from '@/lib/api';

const ERROR_KEY_BY_CODE: Record<string, string> = {
  EMAIL_ALREADY_EXISTS: 'errorEmailExists',
  INVALID_CREDENTIALS: 'errorInvalidCredentials',
  RATE_LIMITED: 'errorRateLimited',
};

export function authErrorKey(error: unknown): string {
  if (error instanceof ApiError) {
    return ERROR_KEY_BY_CODE[error.code] ?? 'errorGeneric';
  }
  return 'errorGeneric';
}
