import { z } from 'zod';

/** Server-only settings. Never prefix these with NEXT_PUBLIC_: they must not reach the browser. */
export const configSchema = z.object({
  API_URL: z.url({ protocol: /^https?$/ }),
});

export type AdminConfig = z.infer<typeof configSchema>;

/** Thrown when the environment is invalid. Lists variable names and reasons, never values. */
export class ConfigValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Invalid configuration:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    this.name = 'ConfigValidationError';
  }
}

export function parseConfig(env: Readonly<Record<string, string | undefined>>): AdminConfig {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    // Only the variable name and issue code: Zod messages can echo the received value.
    throw new ConfigValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.code}`),
    );
  }
  return result.data;
}

let config: AdminConfig | undefined;

/** The validated config, parsed once per server process. */
export function getConfig(): AdminConfig {
  config ??= parseConfig(process.env);
  return config;
}
