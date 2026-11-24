import { describe, expect, it } from 'vitest';

import { ConfigValidationError, parseConfig } from './config.js';

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
  it('applies defaults for an empty environment', () => {
    expect(parseConfig({})).toEqual({
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: 3000,
      LOG_LEVEL: 'info',
    });
  });

  it('coerces PORT from a string', () => {
    expect(parseConfig({ PORT: '8080' }).PORT).toBe(8080);
  });

  it('names every invalid variable', () => {
    const { issues } = validationErrorFor({ PORT: '70000', NODE_ENV: 'staging' });
    expect(issues.map((issue) => issue.split(':')[0])).toEqual(['NODE_ENV', 'PORT']);
  });

  it('never includes the received values in the error', () => {
    const error = validationErrorFor({ LOG_LEVEL: 'super-secret-value' });
    expect(error.message).not.toContain('super-secret-value');
  });
});
