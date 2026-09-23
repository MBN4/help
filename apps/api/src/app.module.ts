import { Controller, Get, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { validateEnv, Env } from './config/env.schema';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './integrations/redis/redis.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { Public } from './common/decorators/public.decorator';
import { AuthModule } from './modules/auth/auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { GeoModule } from './modules/geo/geo.module';
import { LocationsModule } from './modules/locations/locations.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';

@Controller('health')
class HealthController {
  @Public()
  @Get()
  getHealth(): { status: 'ok' } {
    return { status: 'ok' };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        throttlers: [{ limit: 100, ttl: 60_000 }],
        storage: new ThrottlerStorageRedisService(
          config.get('REDIS_URL', { infer: true }),
        ),
      }),
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    AdminModule,
    GeoModule,
    LocationsModule,
    CategoriesModule,
    BusinessesModule,
    DiscoveryModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
