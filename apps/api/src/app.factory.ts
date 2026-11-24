import type { IncomingMessage } from 'node:http';

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import type { AppConfig } from './config/config.js';
import { ProblemDetailsFilter } from './http/problem-details.filter.js';
import { REQUEST_ID_HEADER, resolveRequestId } from './http/request-id.js';

/** Builds a fully configured app without listening, so tests can use `inject()`. */
export async function createApp(config: AppConfig): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({
    genReqId: (req: IncomingMessage) => resolveRequestId(req.headers[REQUEST_ID_HEADER]),
  });
  adapter.getInstance().addHook('onRequest', async (request, reply) => {
    void reply.header(REQUEST_ID_HEADER, request.id);
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot(config),
    adapter,
    // Nest types these options as a class, so a plain object literal trips this rule.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-class-instance-assignment -- plain options object
    { bufferLogs: true },
  );
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new ProblemDetailsFilter());
  // Lets ECS stop the task gracefully: in-flight requests finish on SIGTERM.
  app.enableShutdownHooks();
  return app;
}
