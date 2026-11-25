import { createRequire } from 'node:module';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { livenessSchema, readinessProblemSchema } from '@shop/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.factory.js';
import { parseConfig } from '../src/config/config.js';

interface OpenApiDocument {
  paths: Record<string, Record<string, unknown>>;
}

const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);

const openapi = createRequire(import.meta.url)('@shop/contracts/openapi.json') as OpenApiDocument;

/** `GET /products/{id}` (OpenAPI) and `GET /products/:id` (Fastify) become the same key. */
function contractRoutes(): string[] {
  return Object.entries(openapi.paths).flatMap(([path, item]) =>
    Object.keys(item)
      .filter((method) => HTTP_METHODS.has(method))
      .map((method) => `${method.toUpperCase()} ${path.replaceAll(/\{(\w+)\}/g, ':$1')}`),
  );
}

describe('API matches @shop/contracts', () => {
  let app: NestFastifyApplication;
  const registered: string[] = [];

  beforeAll(async () => {
    app = await createApp(
      parseConfig({
        LOG_LEVEL: 'silent',
        DATABASE_URL: 'postgres://test:test@127.0.0.1:1/test',
        REDIS_URL: 'redis://127.0.0.1:1',
      }),
    );
    // Routes are registered during init(), so the hook must be in place before it.
    app
      .getHttpAdapter()
      .getInstance()
      .addHook('onRoute', ({ method, url }) => {
        for (const m of [method].flat()) {
          // Fastify adds a HEAD route for every GET automatically.
          if (m !== 'HEAD') registered.push(`${m} ${url}`);
        }
      });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('implements exactly the routes in openapi.json', () => {
    expect(registered.toSorted()).toEqual(contractRoutes().toSorted());
  });

  it('GET /health/live matches the Liveness schema', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/live' });
    expect(livenessSchema.safeParse(response.json()).success).toBe(true);
  });

  it('GET /health/ready (Postgres down) matches the ReadinessProblem schema', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(response.statusCode).toBe(503);
    expect(readinessProblemSchema.safeParse(response.json()).success).toBe(true);
  });
});
