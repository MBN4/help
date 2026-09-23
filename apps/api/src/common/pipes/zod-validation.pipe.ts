import { PipeTransform } from '@nestjs/common';
import { ZodType } from 'zod';
import { AppException } from '../exceptions/app.exception';

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new AppException(
        400,
        'VALIDATION_ERROR',
        'Invalid request body',
        result.error.issues,
      );
    }
    return result.data;
  }
}
