import { Controller, Get, Inject } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import type { Redis } from 'ioredis';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../integrations/storage/storage.service';
import { REDIS_CLIENT } from '../../integrations/redis/redis.constants';

/**
 * Real connectivity checks (Phase 9) — replaces the Phase 0 stub that always returned `{status: 'ok'}`
 * regardless of downstream health. Reuses each dependency's existing client (PrismaService, the shared
 * Redis client, StorageService's S3 client) rather than opening new connections.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicators: HealthIndicatorService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.checkDatabase(),
      () => this.checkRedis(),
      () => this.checkStorage(),
    ]);
  }

  private async checkDatabase(): Promise<HealthIndicatorResult> {
    const indicator = this.indicators.check('database');
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return indicator.up();
    } catch (error) {
      return indicator.down(this.errorMessage(error));
    }
  }

  private async checkRedis(): Promise<HealthIndicatorResult> {
    const indicator = this.indicators.check('redis');
    try {
      await this.redis.ping();
      return indicator.up();
    } catch (error) {
      return indicator.down(this.errorMessage(error));
    }
  }

  private async checkStorage(): Promise<HealthIndicatorResult> {
    const indicator = this.indicators.check('storage');
    try {
      await this.storage.pingBucket();
      return indicator.up();
    } catch (error) {
      return indicator.down(this.errorMessage(error));
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }
}
