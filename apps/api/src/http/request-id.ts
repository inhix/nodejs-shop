import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

// Restricts what a client can inject into our logs via the header.
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

/** Reuses a well-formed incoming request ID (e.g. from the load balancer), otherwise creates one. */
export function resolveRequestId(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  return value !== undefined && REQUEST_ID_PATTERN.test(value) ? value : randomUUID();
}
