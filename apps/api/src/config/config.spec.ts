import { describe, expect, it } from 'vitest';

import { ConfigValidationError, parseConfig } from './config.js';

const REQUIRED = {
  DATABASE_URL: 'postgres://shop:secret-password@127.0.0.1:5432/shop',
  REDIS_URL: 'redis://127.0.0.1:6379',
};

function validationErrorFor(env: Record<string, string>): ConfigValidationError {
  try {
    parseConfig(env);
  } catch (error) {
    if (error instanceof ConfigValidationError) return error;
    throw error;
  }
  throw new Error('Expected parseConfig to throw ConfigValidationError');
}

describe('parseConfig', () => {
  it('applies defaults when only the required variables are set', () => {
    expect(parseConfig(REQUIRED)).toEqual({
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: 3000,
      LOG_LEVEL: 'info',
      ...REQUIRED,
    });
  });

  it('coerces PORT from a string', () => {
    expect(parseConfig({ ...REQUIRED, PORT: '8080' }).PORT).toBe(8080);
  });

  it('names every invalid variable', () => {
    const { issues } = validationErrorFor({ ...REQUIRED, PORT: '70000', NODE_ENV: 'staging' });
    expect(issues.map((issue) => issue.split(':')[0])).toEqual(['NODE_ENV', 'PORT']);
  });

  it('requires the connection strings', () => {
    const { issues } = validationErrorFor({});
    expect(issues.map((issue) => issue.split(':')[0])).toEqual(['DATABASE_URL', 'REDIS_URL']);
  });

  it('accepts postgresql:// and rediss:// (TLS)', () => {
    const config = parseConfig({
      DATABASE_URL: 'postgresql://shop@db.internal/shop',
      REDIS_URL: 'rediss://cache.internal:6379',
    });
    expect(config.DATABASE_URL).toBe('postgresql://shop@db.internal/shop');
  });

  it('rejects connection strings with the wrong scheme', () => {
    const { issues } = validationErrorFor({
      DATABASE_URL: 'mysql://shop@127.0.0.1/shop',
      REDIS_URL: 'http://127.0.0.1:6379',
    });
    expect(issues.map((issue) => issue.split(':')[0])).toEqual(['DATABASE_URL', 'REDIS_URL']);
  });

  it('never includes the received values in the error', () => {
    const error = validationErrorFor({
      DATABASE_URL: 'mysql://shop:secret-password@127.0.0.1/shop',
      REDIS_URL: REQUIRED.REDIS_URL,
      LOG_LEVEL: 'super-secret-value',
    });
    expect(error.message).not.toContain('super-secret-value');
    expect(error.message).not.toContain('secret-password');
  });
});
