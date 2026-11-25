import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.factory.js';
import { bootstrap } from '../src/bootstrap.js';
import { ConfigValidationError, parseConfig } from '../src/config/config.js';

describe('API (HTTP)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    // No database or Redis needed: the pool connects lazily and Redis in the background.
    app = await createApp(
      parseConfig({
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
        DATABASE_URL: 'postgres://test:test@127.0.0.1:1/test',
        REDIS_URL: 'redis://127.0.0.1:1',
      }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health/live returns 200 with a generated request ID', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/live' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('echoes a valid incoming request ID', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/live',
      headers: { 'x-request-id': 'lb-trace-42' },
    });
    expect(response.headers['x-request-id']).toBe('lb-trace-42');
  });

  it('answers unknown routes with an RFC 9457 problem', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/does-not-exist',
      headers: { 'x-request-id': 'trace-404' },
    });
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toMatchObject({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      instance: '/does-not-exist',
      requestId: 'trace-404',
    });
  });
});

describe('bootstrap', () => {
  it('refuses to boot on invalid config', async () => {
    await expect(bootstrap({ PORT: 'not-a-port', LOG_LEVEL: 'silent' })).rejects.toBeInstanceOf(
      ConfigValidationError,
    );
  });
});
