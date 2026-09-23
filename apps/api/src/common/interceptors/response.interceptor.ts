import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta: PaginationMeta | null;
}

function isPaginatedShape(
  value: unknown,
): value is { data: unknown; meta: PaginationMeta } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    'meta' in value &&
    typeof (value as { meta: unknown }).meta === 'object'
  );
}

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<
  T,
  SuccessResponse<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessResponse<T>> {
    return next.handle().pipe(
      map((result) => {
        if (isPaginatedShape(result)) {
          return { success: true, data: result.data as T, meta: result.meta };
        }
        return { success: true, data: result, meta: null };
      }),
    );
  }
}
