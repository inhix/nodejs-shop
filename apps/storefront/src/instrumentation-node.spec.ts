import { afterEach, describe, expect, it, vi } from 'vitest';

import { validateConfigOrExit } from './instrumentation-node';

describe('validateConfigOrExit', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('exits with code 1 and names the variable when API_URL is missing', () => {
    vi.stubEnv('API_URL', undefined);
    // A real exit never returns; the mock throws so execution stops at the same point.
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    expect(validateConfigOrExit).toThrow('process.exit');

    expect(exit).toHaveBeenCalledWith(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('API_URL'));
  });
});
