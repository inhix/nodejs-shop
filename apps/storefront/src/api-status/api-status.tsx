import { createApiClient } from '@shop/api-client';
import { connection } from 'next/server';

import { getConfig } from '../config';
import { getApiStatus } from './get-api-status';
import type { ApiStatus as Status } from './get-api-status';

const LABELS: Record<Status, string> = {
  ok: 'API працює',
  degraded: 'API працює з обмеженнями',
  'database-down': 'API працює, але база даних недоступна',
  unavailable: 'API недоступний',
};

/** Server component: renders on each request, so the build never needs a running API. */
export async function ApiStatus() {
  await connection();
  const status = await getApiStatus(createApiClient({ baseUrl: getConfig().API_URL }));
  return (
    <p className="text-sm text-neutral-600" data-status={status}>
      {LABELS[status]}
    </p>
  );
}
