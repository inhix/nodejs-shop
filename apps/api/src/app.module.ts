import { Module, RequestMethod } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import type { AppConfig } from './config/config.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health/health.controller.js';
import { RedisModule } from './redis/redis.module.js';

export const APP_CONFIG = Symbol('APP_CONFIG');

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        LoggerModule.forRoot({
          // Load balancer health probes would otherwise dominate the logs.
          exclude: [
            { method: RequestMethod.GET, path: 'health/live' },
            { method: RequestMethod.GET, path: 'health/ready' },
          ],
          pinoHttp: {
            level: config.LOG_LEVEL,
            // The request ID comes from Fastify (see app.factory.ts); pino-http reuses req.id.
            redact: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
            ],
            ...(config.NODE_ENV === 'development' && {
              transport: { target: 'pino-pretty', options: { singleLine: true } },
            }),
          },
        }),
        DatabaseModule.forRoot(config.DATABASE_URL),
        RedisModule.forRoot(config.REDIS_URL),
      ],
      controllers: [HealthController],
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    };
  }
}
