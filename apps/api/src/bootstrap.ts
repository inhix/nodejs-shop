import type { NestFastifyApplication } from '@nestjs/platform-fastify';

import { createApp } from './app.factory.js';
import { parseConfig } from './config/config.js';

/** Validates config before anything else starts, then listens. Throws on invalid config. */
export async function bootstrap(
  env: Readonly<Record<string, string | undefined>>,
): Promise<NestFastifyApplication> {
  const config = parseConfig(env);
  const app = await createApp(config);
  await app.listen({ host: config.HOST, port: config.PORT });
  return app;
}
