import type { ApiClient } from '@shop/api-client';

export type ApiStatus = 'ok' | 'degraded' | 'unavailable';

/** Asks the API's readiness probe. Any error, timeout or 503 counts as unavailable. */
export async function getApiStatus(client: ApiClient, timeoutMs = 2_000): Promise<ApiStatus> {
  try {
    const { data } = await client.GET('/health/ready', {
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    return data?.status ?? 'unavailable';
  } catch {
    return 'unavailable';
  }
}
