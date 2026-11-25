import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { createOpenApiDocument } from './openapi.js';

describe('openapi.json', () => {
  it('is up to date with the schemas (run `pnpm generate` if this fails)', () => {
    const committed: unknown = JSON.parse(
      readFileSync(new URL('../openapi.json', import.meta.url), 'utf8'),
    );
    expect(committed).toEqual(JSON.parse(JSON.stringify(createOpenApiDocument())));
  });
});
