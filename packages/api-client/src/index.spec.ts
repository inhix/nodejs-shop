import { describe, expect, it } from 'vitest';

import { createApiClient } from './index.js';

function jsonResponse(status: number, body: unknown, contentType = 'application/json'): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': contentType } });
}

describe('createApiClient', () => {
  it('calls the API under baseUrl and returns typed data', async () => {
    const requests: Request[] = [];
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      fetch: (request: Request) => {
        requests.push(request);
        return Promise.resolve(
          jsonResponse(200, { status: 'ok', checks: { postgres: 'up', redis: 'up' } }),
        );
      },
    });

    const { data, error } = await client.GET('/health/ready');

    expect(requests[0]?.url).toBe('https://api.example.test/health/ready');
    expect(error).toBeUndefined();
    expect(data?.checks.postgres).toBe('up');
  });

  it('returns Problem Details as a typed error', async () => {
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      fetch: () =>
        Promise.resolve(
          jsonResponse(
            503,
            {
              type: 'about:blank',
              title: 'Service Unavailable',
              status: 503,
              instance: '/health/ready',
              checks: { postgres: 'down', redis: 'up' },
            },
            'application/problem+json',
          ),
        ),
    });

    const { data, error } = await client.GET('/health/ready');

    expect(data).toBeUndefined();
    expect(error?.checks.postgres).toBe('down');
  });
});
