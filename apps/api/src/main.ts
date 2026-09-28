import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import * as Sentry from '@sentry/node';
import { AppModule } from './app.module';

// Error tracking is opt-in: no `SENTRY_DSN` means no Sentry init at all, same "stub until credentialed"
// pattern as OAuth/mail (see AllExceptionsFilter's SentryService for where captured exceptions go).
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
  });
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  if (process.env.NODE_ENV === 'production') {
    // Behind a real reverse proxy in production, trust its X-Forwarded-For so `request.ip` (used by the
    // Phase 8 moderation-scoring IP signals) reflects the real client, not the proxy's address.
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  await app.listen(Number(process.env.PORT ?? 4000));
}

void bootstrap();
