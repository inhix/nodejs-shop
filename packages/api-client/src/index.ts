import createClient from 'openapi-fetch';
import type { Client, ClientOptions } from 'openapi-fetch';

import type { components, paths } from './generated/schema.js';

export type { components, paths };

/** A typed API client: paths, parameters, bodies and responses all come from the contracts. */
export function createApiClient(options: ClientOptions & { baseUrl: string }): Client<paths> {
  return createClient<paths>(options);
}

export type ApiClient = Client<paths>;
