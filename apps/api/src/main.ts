import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

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
