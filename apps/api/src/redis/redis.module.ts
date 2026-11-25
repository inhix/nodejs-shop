import { Inject, Logger, Module } from '@nestjs/common';
import type { DynamicModule, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { createClient } from 'redis';

/** Injection token for the shared Redis client. */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

const MAX_RECONNECT_DELAY_MS = 5_000;

const logger = new Logger('Redis');

export function createRedisClient(url: string) {
  const client = createClient({
    url,
    // While disconnected, commands fail immediately instead of waiting in memory,
    // so callers can fall back (Redis is optional; see "Redis" in CLAUDE.md).
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 2_000,
      // Never give up: exponential backoff from 100 ms, capped.
      reconnectStrategy: (retries) => Math.min(100 * 2 ** retries, MAX_RECONNECT_DELAY_MS),
    },
  });
  // Emitted on every failed (re)connect attempt. Without a listener the process crashes.
  client.on('error', (error: unknown) => {
    logger.warn({ err: error }, 'Redis connection error');
  });
  return client;
}

export type RedisClient = ReturnType<typeof createRedisClient>;

/** Provides `REDIS_CLIENT` app-wide. Connects in the background: Redis being down never blocks boot. */
@Module({})
export class RedisModule implements OnModuleInit, OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly client: RedisClient) {}

  static forRoot(redisUrl: string): DynamicModule {
    return {
      module: RedisModule,
      global: true,
      providers: [{ provide: REDIS_CLIENT, useFactory: () => createRedisClient(redisUrl) }],
      exports: [REDIS_CLIENT],
    };
  }

  onModuleInit(): void {
    // Not awaited on purpose. It resolves once connected and retries forever until then;
    // it rejects only if the client is closed while still connecting.
    this.client.connect().catch((error: unknown) => {
      logger.debug({ err: error }, 'Redis connect stopped');
    });
  }

  onApplicationShutdown(): void {
    // destroy() also stops a reconnect loop that is still running.
    if (this.client.isOpen) {
      this.client.destroy();
    }
  }
}
