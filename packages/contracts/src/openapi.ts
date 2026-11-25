import { createDocument } from 'zod-openapi';
import type { ZodOpenApiObject } from 'zod-openapi';

import { livenessSchema, readinessProblemSchema, readinessSchema } from './health.js';

/** Every API route. The API's contract test fails if its routes and these paths differ. */
const paths: ZodOpenApiObject['paths'] = {
  '/health/live': {
    get: {
      operationId: 'getLiveness',
      tags: ['health'],
      summary: 'Liveness probe',
      responses: {
        '200': {
          description: 'The process is up.',
          content: { 'application/json': { schema: livenessSchema } },
        },
      },
    },
  },
  '/health/ready': {
    get: {
      operationId: 'getReadiness',
      tags: ['health'],
      summary: 'Readiness probe for the load balancer',
      responses: {
        '200': {
          description: 'The instance can serve traffic (possibly degraded).',
          content: { 'application/json': { schema: readinessSchema } },
        },
        '503': {
          description: 'Postgres is unavailable.',
          content: { 'application/problem+json': { schema: readinessProblemSchema } },
        },
      },
    },
  },
};

export function createOpenApiDocument(): ReturnType<typeof createDocument> {
  return createDocument({
    openapi: '3.1.0',
    info: { title: 'Shop API', version: '0.0.0' },
    paths,
  });
}
