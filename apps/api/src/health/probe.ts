import { setTimeout } from 'node:timers/promises';

import type { CheckStatus, Readiness, ReadinessChecks } from '@shop/contracts';

/** The contract's statuses, plus `unavailable`, which the API answers with a 503 problem. */
export type ReadinessStatus = Readiness['status'] | 'unavailable';

/** Runs `check` with a time limit. Any error or timeout counts as down. */
export async function probe(
  check: () => Promise<unknown>,
  timeoutMs: number,
): Promise<CheckStatus> {
  const timer = new AbortController();
  const timeout = setTimeout(timeoutMs, undefined, { signal: timer.signal }).then(() => {
    throw new Error(`Check timed out after ${String(timeoutMs)} ms`);
  });
  try {
    await Promise.race([check(), timeout]);
    return 'up';
  } catch {
    return 'down';
  } finally {
    timer.abort();
  }
}

/**
 * Postgres is required to serve traffic. Redis is not: without it the shop is degraded but
 * checkout keeps working, so the instance stays in the load balancer.
 */
export function readinessStatus(checks: ReadinessChecks): ReadinessStatus {
  if (checks.postgres === 'down') return 'unavailable';
  if (checks.redis === 'down') return 'degraded';
  return 'ok';
}
