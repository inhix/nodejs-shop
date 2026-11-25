import { z } from 'zod';

/**
 * RFC 9457 Problem Details, the body of every API error (`application/problem+json`).
 * Loose on purpose: an error may add extension members, e.g. `checks` on readiness.
 */
export const problemDetailsSchema = z
  .looseObject({
    type: z.string(),
    title: z.string(),
    status: z.int().min(400).max(599),
    detail: z.string().optional(),
    instance: z.string(),
    requestId: z.string().optional(),
  })
  .meta({ id: 'ProblemDetails', description: 'RFC 9457 Problem Details.' });

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
