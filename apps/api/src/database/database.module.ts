import { Inject, Logger, Module } from '@nestjs/common';
import type { DynamicModule, OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';

/** Injection token for the shared Postgres connection pool. */
export const PG_POOL = Symbol('PG_POOL');

const logger = new Logger('Database');

export function createPool(connectionString: string): Pool {
  const pool = new Pool({
    connectionString,
    application_name: 'shop-api',
    max: 10,
    // Fail fast instead of queueing requests behind an unreachable database.
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });
  // An idle connection dropped by the server (restart, failover) is emitted here.
  // Without a listener Node treats it as unhandled and the process crashes.
  pool.on('error', (error) => {
    logger.warn({ err: error }, 'Idle Postgres connection failed');
  });
  return pool;
}

/** Provides `PG_POOL` app-wide. Connections open lazily, on the first query. */
@Module({})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  static forRoot(databaseUrl: string): DynamicModule {
    return {
      module: DatabaseModule,
      global: true,
      providers: [{ provide: PG_POOL, useFactory: () => createPool(databaseUrl) }],
      exports: [PG_POOL],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
