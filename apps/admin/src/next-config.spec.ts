import { PHASE_PRODUCTION_SERVER } from 'next/constants';
import { describe, expect, it } from 'vitest';

import config, { NOINDEX_HEADER } from '../next.config';

describe('next.config', () => {
  it('sends X-Robots-Tag: noindex, nofollow on every path', async () => {
    const rules = await config(PHASE_PRODUCTION_SERVER).headers?.();
    expect(rules).toEqual([{ source: '/:path*', headers: [NOINDEX_HEADER] }]);
    expect(NOINDEX_HEADER).toEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' });
  });
});
