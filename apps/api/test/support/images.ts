import { readFileSync } from 'node:fs';

const COMPOSE_FILE = new URL('../../../../docker-compose.yml', import.meta.url);

/**
 * The image tag of a service in the root docker-compose.yml. Tests use it, so Compose and
 * Testcontainers always run the same Postgres and Redis versions (see CLAUDE.md).
 */
export function composeImage(service: string): string {
  const lines = readFileSync(COMPOSE_FILE, 'utf8').split('\n');
  const start = lines.indexOf(`  ${service}:`);
  if (start === -1) throw new Error(`Service "${service}" not found in docker-compose.yml`);
  for (const line of lines.slice(start + 1)) {
    if (/^ {2}\S/.test(line)) break; // next service
    const image = /^ {4}image:\s*(\S+)/.exec(line)?.[1];
    if (image !== undefined) return image;
  }
  throw new Error(`Service "${service}" has no image in docker-compose.yml`);
}
