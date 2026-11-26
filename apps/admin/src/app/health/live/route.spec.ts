import { describe, expect, it } from 'vitest';

import { GET } from './route';

describe('GET /health/live', () => {
  it('answers 200 without touching dependencies', async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});
