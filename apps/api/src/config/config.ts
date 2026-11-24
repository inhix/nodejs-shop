import { z } from 'zod';

export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type AppConfig = z.infer<typeof configSchema>;

/** Thrown when the environment is invalid. Lists variable names and reasons, never values. */
export class ConfigValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Invalid configuration:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    this.name = 'ConfigValidationError';
  }
}

export function parseConfig(env: Readonly<Record<string, string | undefined>>): AppConfig {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    // Only the variable name and issue code: Zod messages can echo the received value.
    throw new ConfigValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.code}`),
    );
  }
  return result.data;
}
