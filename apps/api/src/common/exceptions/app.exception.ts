import { HttpException } from '@nestjs/common';

export interface AppExceptionPayload {
  code: string;
  message: string;
  details?: unknown;
}

export class AppException extends HttpException {
  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    const payload: AppExceptionPayload = { code, message, details };
    super(payload, status);
  }
}

export function isAppExceptionPayload(
  value: unknown,
): value is AppExceptionPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof (value as { code: unknown }).code === 'string'
  );
}
