import { bootstrap } from './bootstrap.js';
import { ConfigValidationError } from './config/config.js';

try {
  await bootstrap(process.env);
} catch (error) {
  if (error instanceof ConfigValidationError) {
    // The logger is not configured yet; write the reason and refuse to boot.
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
  throw error;
}
