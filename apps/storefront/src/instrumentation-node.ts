import { ConfigValidationError, getConfig } from './config';

/**
 * Next.js only logs errors thrown during startup and keeps serving 500s. Invalid config must
 * stop the process instead, so the container fails fast (CLAUDE.md: refuse to boot).
 */
export function validateConfigOrExit(): void {
  try {
    getConfig();
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
}
