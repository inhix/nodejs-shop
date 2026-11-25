import { describe, expect, it } from 'vitest';

import { readinessProblemSchema, readinessSchema } from './health.js';

describe('health contracts', () => {
  it('accepts a degraded readiness report', () => {
    const report = { status: 'degraded', checks: { postgres: 'up', redis: 'down' } };
    expect(readinessSchema.parse(report)).toEqual(report);
  });

  it('rejects an unknown readiness status', () => {
    expect(
      readinessSchema.safeParse({
        status: 'unavailable',
        checks: { postgres: 'down', redis: 'up' },
      }).success,
    ).toBe(false);
  });

  it('keeps Problem Details extension members on the readiness problem', () => {
    const problem = {
      type: 'about:blank',
      title: 'Service Unavailable',
      status: 503,
      instance: '/health/ready',
      checks: { postgres: 'down', redis: 'up' },
    };
    expect(readinessProblemSchema.parse(problem)).toEqual(problem);
  });
});
