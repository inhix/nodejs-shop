import { Controller, Get, HttpStatus, Inject } from '@nestjs/common';
import type { Liveness, Readiness } from '@shop/contracts';
import type { Pool } from 'pg';

import { PG_POOL } from '../database/database.module.js';
import { ProblemException } from '../http/problem-details.filter.js';
import { REDIS_CLIENT } from '../redis/redis.module.js';
import type { RedisClient } from '../redis/redis.module.js';
import { probe, readinessStatus } from './probe.js';

const CHECK_TIMEOUT_MS = 1_000;

@Controller('health')
export class HealthController {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
  ) {}

  /** Liveness: the process is up and serving HTTP. Deliberately has no dependencies. */
  @Get('live')
  live(): Liveness {
    return { status: 'ok' };
  }

  /** Readiness: whether this instance can serve traffic. Used by the load balancer. */
  @Get('ready')
  async ready(): Promise<Readiness> {
    const [postgres, redis] = await Promise.all([
      probe(() => this.pool.query('SELECT 1'), CHECK_TIMEOUT_MS),
      probe(() => this.redis.ping(), CHECK_TIMEOUT_MS),
    ]);
    const checks = { postgres, redis };
    const status = readinessStatus(checks);
    if (status === 'unavailable') {
      throw new ProblemException(HttpStatus.SERVICE_UNAVAILABLE, { checks });
    }
    return { status, checks };
  }
}
