import { z } from 'zod';

import { problemDetailsSchema } from './common/problem-details.js';

export const livenessSchema = z
  .object({ status: z.literal('ok') })
  .meta({ id: 'Liveness', description: 'The process is up. Never depends on Postgres or Redis.' });

export const checkStatusSchema = z.enum(['up', 'down']).meta({ id: 'CheckStatus' });

export const readinessChecksSchema = z
  .object({ postgres: checkStatusSchema, redis: checkStatusSchema })
  .meta({ id: 'ReadinessChecks' });

export const readinessSchema = z
  .object({ status: z.enum(['ok', 'degraded']), checks: readinessChecksSchema })
  .meta({
    id: 'Readiness',
    description: '`degraded`: Redis is down, but the instance can still serve traffic.',
  });

export const readinessProblemSchema = problemDetailsSchema
  .extend({ status: z.literal(503), checks: readinessChecksSchema })
  .meta({ id: 'ReadinessProblem', description: 'Postgres is down; the instance cannot serve.' });

export type Liveness = z.infer<typeof livenessSchema>;
export type CheckStatus = z.infer<typeof checkStatusSchema>;
export type ReadinessChecks = z.infer<typeof readinessChecksSchema>;
export type Readiness = z.infer<typeof readinessSchema>;
export type ReadinessProblem = z.infer<typeof readinessProblemSchema>;
