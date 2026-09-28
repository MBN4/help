import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@buisnez/database';
import type { Response } from 'express';
import { isAppExceptionPayload } from '../exceptions/app.exception';
import { SentryService } from '../../integrations/sentry/sentry.service';

interface ErrorResponseBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

const STATUS_CODE_FALLBACK: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'RATE_LIMITED',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly sentry: SentryService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.resolve(exception);

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : exception,
      );
      // Additive observability only — never changes the client-facing envelope/behavior above. Restricted
      // to the truly unexpected/unmapped cases (INTERNAL_ERROR), not an intentional 500 HttpException with
      // its own AppException payload/code.
      if (body.error.code === 'INTERNAL_ERROR') {
        this.sentry.captureException(exception);
      }
    }

    response.status(status).json(body);
  }

  private resolve(exception: unknown): {
    status: number;
    body: ErrorResponseBody;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (isAppExceptionPayload(payload)) {
        return { status, body: { success: false, error: payload } };
      }
      const message = typeof payload === 'string' ? payload : exception.message;
      return {
        status,
        body: {
          success: false,
          error: { code: STATUS_CODE_FALLBACK[status] ?? 'ERROR', message },
        },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.resolvePrismaError(exception);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
      },
    };
  }

  private resolvePrismaError(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    body: ErrorResponseBody;
  } {
    switch (exception.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          body: {
            success: false,
            error: { code: 'CONFLICT', message: 'Resource already exists' },
          },
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          body: {
            success: false,
            error: { code: 'NOT_FOUND', message: 'Resource not found' },
          },
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          body: {
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
          },
        };
    }
  }
}
