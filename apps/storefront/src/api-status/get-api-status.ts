import type { ApiClient } from '@shop/api-client';

/**
 * - `degraded`: the API serves without Redis.
 * - `database-down`: the API answers, but reports Postgres as down (503), so it cannot serve.
 * - `unavailable`: no usable answer (unreachable, timeout, or any other error).
 */
export type ApiStatus = 'ok' | 'degraded' | 'database-down' | 'unavailable';

/** Asks the API's readiness probe. */
export async function getApiStatus(client: ApiClient, timeoutMs = 2_000): Promise<ApiStatus> {
  try {
    const { data, error, response } = await client.GET('/health/ready', {
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    if (data) return data.status;
    // Only the 503 response carries readiness checks (see the contract); other errors do not.
    return response.status === 503 && error.checks.postgres === 'down'
      ? 'database-down'
      : 'unavailable';
  } catch {
    return 'unavailable';
  }
}
