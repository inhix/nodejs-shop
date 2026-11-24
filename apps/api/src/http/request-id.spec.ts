import { describe, expect, it } from 'vitest';

import { resolveRequestId } from './request-id.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('resolveRequestId', () => {
  it('reuses a well-formed incoming ID', () => {
    expect(resolveRequestId('abc-123_X.y')).toBe('abc-123_X.y');
  });

  it('uses the first value when the header is repeated', () => {
    expect(resolveRequestId(['first', 'second'])).toBe('first');
  });

  it.each([undefined, '', 'has space', 'line\nbreak', 'a'.repeat(129)])(
    'generates a UUID for %j',
    (header) => {
      expect(resolveRequestId(header)).toMatch(UUID);
    },
  );
});
