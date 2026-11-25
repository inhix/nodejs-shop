import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { readinessSchema } from '@shop/contracts';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import type { StartedRedisContainer } from '@testcontainers/redis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.factory.js';
import { parseConfig } from '../src/config/config.js';
import { composeImage } from './support/images.js';

// Nothing listens on port 1, so connections are refused immediately.
const UNREACHABLE_REDIS_URL = 'redis://127.0.0.1:1';

async function startApp(databaseUrl: string, redisUrl: string): Promise<NestFastifyApplication> {
  const app = await createApp(
    parseConfig({ LOG_LEVEL: 'silent', DATABASE_URL: databaseUrl, REDIS_URL: redisUrl }),
  );
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

async function readiness(app: NestFastifyApplication) {
  const response = await app.inject({ method: 'GET', url: '/health/ready' });
  return { statusCode: response.statusCode, body: response.json<Record<string, unknown>>() };
}

// The tests run in order and share containers: each one breaks a little more.
describe('GET /health/ready (real Postgres and Redis)', () => {
  let postgres: StartedPostgreSqlContainer;
  let redis: StartedRedisContainer;
  let app: NestFastifyApplication;

  beforeAll(async () => {
    [postgres, redis] = await Promise.all([
      new PostgreSqlContainer(composeImage('postgres')).start(),
      new RedisContainer(composeImage('redis')).start(),
    ]);
    app = await startApp(postgres.getConnectionUri(), redis.getConnectionUrl());
  });

  afterAll(async () => {
    await app.close();
    // Containers stopped by a test are skipped; Testcontainers also reaps leftovers.
    await Promise.allSettled([postgres.stop(), redis.stop()]);
  });

  it('is ok when Postgres and Redis are up', async () => {
    // Redis connects in the background, so the first probe may run before it is ready.
    await expect
      .poll(async () => (await readiness(app)).body)
      .toEqual({
        status: 'ok',
        checks: { postgres: 'up', redis: 'up' },
      });
    expect(readinessSchema.safeParse((await readiness(app)).body).success).toBe(true);
  });

  it('boots and reports degraded when Redis is unreachable from the start', async () => {
    const appWithoutRedis = await startApp(postgres.getConnectionUri(), UNREACHABLE_REDIS_URL);
    try {
      expect(await readiness(appWithoutRedis)).toEqual({
        statusCode: 200,
        body: { status: 'degraded', checks: { postgres: 'up', redis: 'down' } },
      });
    } finally {
      await appWithoutRedis.close();
    }
  });

  it('stays in service as degraded when Redis goes down', async () => {
    await redis.stop();
    expect(await readiness(app)).toEqual({
      statusCode: 200,
      body: { status: 'degraded', checks: { postgres: 'up', redis: 'down' } },
    });
  });

  it('answers 503 Problem Details when Postgres goes down', async () => {
    await postgres.stop();
    const response = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(response.statusCode).toBe(503);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toMatchObject({
      type: 'about:blank',
      title: 'Service Unavailable',
      status: 503,
      instance: '/health/ready',
      checks: { postgres: 'down', redis: 'down' },
    });
  });
});
