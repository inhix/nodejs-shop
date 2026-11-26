import { describe, expect, it } from 'vitest';

import { ConfigValidationError, parseConfig } from './config';

describe('parseConfig', () => {
  it('accepts an http(s) API_URL', () => {
    expect(parseConfig({ API_URL: 'http://127.0.0.1:3000' }).API_URL).toBe('http://127.0.0.1:3000');
  });

  it('requires API_URL', () => {
    expect(() => parseConfig({})).toThrow(ConfigValidationError);
  });

  it('rejects other schemes without echoing the value', () => {
    try {
      parseConfig({ API_URL: 'ftp://secret-host.internal' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError);
      expect(String(error)).toContain('API_URL');
      expect(String(error)).not.toContain('secret-host');
    }
  });
});
