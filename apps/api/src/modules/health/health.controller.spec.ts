import { HealthCheckService, HealthIndicatorService } from '@nestjs/terminus';
import { HealthController } from './health.controller';

/** Minimal stand-in for terminus's real `HealthIndicatorService` — enough to exercise the up/down shape. */
function buildIndicatorService(): HealthIndicatorService {
  return {
    check: (key: string) => ({
      up: (data?: unknown) => ({
        [key]: {
          status: 'up',
          ...(data && typeof data === 'object' ? data : {}),
        },
      }),
      down: (data?: unknown) => ({
        [key]: {
          status: 'down',
          ...(typeof data === 'string'
            ? { message: data }
            : data && typeof data === 'object'
              ? data
              : {}),
        },
      }),
    }),
  } as unknown as HealthIndicatorService;
}

/** Mirrors `HealthCheckService.check`'s contract closely enough for a unit test: run every indicator fn and merge results. */
function buildHealthCheckService(): HealthCheckService {
  return {
    check: async (
      indicators: Array<() => Promise<Record<string, unknown>>>,
    ) => {
      const results = await Promise.all(indicators.map((fn) => fn()));
      const info = results.reduce((acc, r) => ({ ...acc, ...r }), {});
      return { status: 'ok', info, error: {}, details: info };
    },
  } as unknown as HealthCheckService;
}

describe('HealthController', () => {
  let prisma: { $queryRaw: jest.Mock };
  let storage: { pingBucket: jest.Mock };
  let redis: { ping: jest.Mock };
  let controller: HealthController;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn() };
    storage = { pingBucket: jest.fn() };
    redis = { ping: jest.fn() };
    controller = new HealthController(
      buildHealthCheckService(),
      buildIndicatorService(),
      prisma as never,
      storage as never,
      redis as never,
    );
  });

  it('reports every dependency up when all checks succeed', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    redis.ping.mockResolvedValue('PONG');
    storage.pingBucket.mockResolvedValue(undefined);

    const result = (await controller.check()) as {
      info: Record<string, { status: string }>;
    };

    expect(result.info.database).toMatchObject({ status: 'up' });
    expect(result.info.redis).toMatchObject({ status: 'up' });
    expect(result.info.storage).toMatchObject({ status: 'up' });
  });

  it('reports a single failing dependency as down without failing the others', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    redis.ping.mockRejectedValue(new Error('connection refused'));
    storage.pingBucket.mockResolvedValue(undefined);

    const result = (await controller.check()) as {
      info: Record<string, { status: string; message?: string }>;
    };

    expect(result.info.database).toMatchObject({ status: 'up' });
    expect(result.info.redis).toMatchObject({
      status: 'down',
      message: 'connection refused',
    });
    expect(result.info.storage).toMatchObject({ status: 'up' });
  });
});
