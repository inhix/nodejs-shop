import { createApiClient } from '@shop/api-client';
import { describe, expect, it } from 'vitest';

import { getApiStatus } from './get-api-status';

function clientReturning(respond: () => Promise<Response>) {
  return createApiClient({ baseUrl: 'http://api.test', fetch: respond });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': status < 400 ? 'application/json' : 'application/problem+json' },
  });
}

describe('getApiStatus', () => {
  it('reports the readiness status when the API answers 200', async () => {
    const client = clientReturning(() =>
      Promise.resolve(json(200, { status: 'degraded', checks: { postgres: 'up', redis: 'down' } })),
    );
    await expect(getApiStatus(client)).resolves.toBe('degraded');
  });

  it('reports database-down when the API answers 503 with Postgres down', async () => {
    const client = clientReturning(() =>
      Promise.resolve(
        json(503, {
          type: 'about:blank',
          title: 'Service Unavailable',
          status: 503,
          instance: '/health/ready',
          checks: { postgres: 'down', redis: 'up' },
        }),
      ),
    );
    await expect(getApiStatus(client)).resolves.toBe('database-down');
  });

  it('reports unavailable on an error without readiness checks', async () => {
    const client = clientReturning(() =>
      Promise.resolve(
        json(500, {
          type: 'about:blank',
          title: 'Internal Server Error',
          status: 500,
          instance: '/health/ready',
        }),
      ),
    );
    await expect(getApiStatus(client)).resolves.toBe('unavailable');
  });

  it('reports unavailable when the API cannot be reached', async () => {
    const client = clientReturning(() => Promise.reject(new TypeError('fetch failed')));
    await expect(getApiStatus(client)).resolves.toBe('unavailable');
  });

  it('reports unavailable when the API hangs past the timeout', async () => {
    // A real fetch keeps its in-flight request alive. Without this reference, nothing holds the
    // hanging Request: it can be garbage-collected together with its signal before the timeout
    // aborts it, and the test hangs at random.
    const inFlight: Request[] = [];
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetch: (request: Request) => {
        inFlight.push(request);
        return new Promise((_, reject) => {
          request.signal.addEventListener('abort', () => {
            reject(request.signal.reason as Error);
          });
        });
      },
    });
    await expect(getApiStatus(client, 20)).resolves.toBe('unavailable');
    expect(inFlight).toHaveLength(1);
  });
});
