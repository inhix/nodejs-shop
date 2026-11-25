import { describe, expect, it } from 'vitest';

import { probe, readinessStatus } from './probe.js';

describe('probe', () => {
  it('reports up when the check resolves', async () => {
    await expect(probe(() => Promise.resolve('PONG'), 100)).resolves.toBe('up');
  });

  it('reports down when the check rejects', async () => {
    await expect(probe(() => Promise.reject(new Error('refused')), 100)).resolves.toBe('down');
  });

  it('reports down when the check hangs past the timeout', async () => {
    await expect(probe(() => new Promise(() => undefined), 20)).resolves.toBe('down');
  });
});

describe('readinessStatus', () => {
  it.each([
    [{ postgres: 'up', redis: 'up' }, 'ok'],
    [{ postgres: 'up', redis: 'down' }, 'degraded'],
    [{ postgres: 'down', redis: 'up' }, 'unavailable'],
    [{ postgres: 'down', redis: 'down' }, 'unavailable'],
  ] as const)('%o -> %s', (checks, expected) => {
    expect(readinessStatus(checks)).toBe(expected);
  });
});
