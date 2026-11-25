// Checks run by `pnpm dev` before starting the apps, so a broken local setup fails with a
// specific fix instead of a storefront that only says the API is unavailable.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

const ROOT = join(import.meta.dirname, '..');
export const ENV_FILE = join(ROOT, '.env');

/**
 * @typedef {{ connect(): Promise<unknown>, end(): Promise<void> }} PgClient
 * @typedef {{ Client: new (config: { connectionString: string, connectionTimeoutMillis: number }) => PgClient }} PgModule
 * @typedef {Readonly<Record<string, string | undefined>>} Env
 */

/**
 * The environment as the apps see it in development: real variables win over the root .env.
 * @param {string} [envFile]
 * @param {Env} [processEnv]
 * @returns {{ env: Env, hasEnvFile: boolean }}
 */
export function loadDevEnv(envFile = ENV_FILE, processEnv = process.env) {
  if (!existsSync(envFile)) return { env: processEnv, hasEnvFile: false };
  const fromFile = parseEnv(readFileSync(envFile, 'utf8'));
  return { env: { ...fromFile, ...processEnv }, hasEnvFile: true };
}

/**
 * @param {Env} env
 * @param {boolean} hasEnvFile
 * @returns {string | null} what to fix, or null when DATABASE_URL is present
 */
export function checkEnv(env, hasEnvFile) {
  if (env.DATABASE_URL) return null;
  return hasEnvFile
    ? 'DATABASE_URL is missing from .env. Compare your .env with .env.example and add the missing lines.'
    : 'There is no .env file. Create it with `cp .env.example .env`, then run `pnpm infra:up`.';
}

/**
 * @param {string} databaseUrl
 * @returns {string} user@host:port/db, without the password
 */
function describeTarget(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    return `${url.username}@${url.hostname}:${url.port || '5432'}${url.pathname}`;
  } catch {
    return 'DATABASE_URL';
  }
}

/**
 * Turns a connection error into the fix a developer needs. Never includes the password.
 * @param {unknown} error
 * @param {string} databaseUrl
 * @returns {string}
 */
export function describeDbError(error, databaseUrl) {
  const target = describeTarget(databaseUrl);
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  const message = error instanceof Error ? error.message : String(error);

  // 28P01 invalid_password, 28000 invalid_authorization (unknown role), 3D000 unknown database.
  if (code === '28P01' || code === '28000' || code === '3D000') {
    return [
      `Postgres rejected DATABASE_URL (${target}): ${message}.`,
      'Postgres keeps the user, password and database it was first created with, and they no',
      'longer match DATABASE_URL in .env. Either set DATABASE_URL to the values the database was',
      'created with, or, if your local data can go, recreate it from .env:',
      '  pnpm infra:reset && pnpm infra:up',
    ].join('\n');
  }
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || /timeout/i.test(message)) {
    return `Postgres is not reachable at ${target}. Start it with \`pnpm infra:up\`.`;
  }
  return `Cannot connect to Postgres at ${target}: ${message}`;
}

/**
 * The API's Postgres driver, resolved from apps/api so the root needs no extra dependency.
 * @returns {PgModule | null} null when it is not installed (the check is then skipped)
 */
export function loadPg() {
  try {
    const require = createRequire(join(ROOT, 'apps', 'api', 'package.json'));
    /** @type {unknown} */
    const pg = require('pg');
    return /** @type {PgModule} */ (pg);
  } catch {
    return null;
  }
}

/**
 * Logs in with DATABASE_URL exactly as the API does.
 * @param {string} databaseUrl
 * @param {() => PgModule | null} [load]
 * @returns {Promise<string | null>} what to fix, or null when the login works or cannot be checked
 */
export async function checkDatabase(databaseUrl, load = loadPg) {
  const pg = load();
  if (!pg) return null;
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 3000 });
  try {
    await client.connect();
    return null;
  } catch (error) {
    return describeDbError(error, databaseUrl);
  } finally {
    await client.end().catch(() => undefined);
  }
}
