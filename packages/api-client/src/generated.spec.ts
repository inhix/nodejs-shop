import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import openapiTS, { astToString, COMMENT_HEADER } from 'openapi-typescript';
import { describe, expect, it } from 'vitest';

describe('src/generated/schema.ts', () => {
  it('is up to date with @shop/contracts (run `pnpm generate` if this fails)', async () => {
    const spec = createRequire(import.meta.url).resolve('@shop/contracts/openapi.json');
    // Same output as the openapi-typescript CLI used by the `generate` script.
    const expected = COMMENT_HEADER + astToString(await openapiTS(pathToFileURL(spec)));
    const committed = readFileSync(new URL('generated/schema.ts', import.meta.url), 'utf8');
    expect(committed).toBe(expected);
  });
});
