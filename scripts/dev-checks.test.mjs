import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { checkDatabase, checkEnv, describeDbError, loadDevEnv } from './dev-checks.mjs';

const URL_WITH_SECRET = 'postgres://shop:s3cret-value@127.0.0.1:5432/shop';

/** @returns {Promise<number>} a port nothing listens on */
function closedPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen({ port: 0, host: '127.0.0.1' }, () => {
      const address = server.address();
      server.close(() => {
        if (address === null || typeof address === 'string') reject(new Error('no port'));
        else resolve(address.port);
      });
    });
  });
}

await test('loadDevEnv reads .env and lets real environment variables win', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'dev-checks-')), '.env');
  writeFileSync(file, 'DATABASE_URL=postgres://from-file\nLOG_LEVEL=info\n');
  const { env, hasEnvFile } = loadDevEnv(file, { DATABASE_URL: 'postgres://from-shell' });
  assert.equal(hasEnvFile, true);
  assert.equal(env.DATABASE_URL, 'postgres://from-shell');
  assert.equal(env.LOG_LEVEL, 'info');
});

await test('loadDevEnv reports a missing .env', () => {
  const missing = join(tmpdir(), 'dev-checks-missing', '.env');
  assert.equal(loadDevEnv(missing, {}).hasEnvFile, false);
});

await test('checkEnv asks to create .env when there is none', () => {
  assert.match(checkEnv({}, false) ?? '', /cp \.env\.example \.env/);
});

await test('checkEnv points at .env.example when DATABASE_URL is missing from .env', () => {
  assert.match(checkEnv({}, true) ?? '', /DATABASE_URL is missing from \.env/);
});

await test('checkEnv passes when DATABASE_URL is set', () => {
  assert.equal(checkEnv({ DATABASE_URL: URL_WITH_SECRET }, true), null);
});

await test('describeDbError explains a password mismatch without printing the password', () => {
  const error = Object.assign(new Error('password authentication failed for user "shop"'), {
    code: '28P01',
  });
  const text = describeDbError(error, URL_WITH_SECRET);
  assert.match(text, /shop@127\.0\.0\.1:5432\/shop/);
  assert.match(text, /pnpm infra:reset && pnpm infra:up/);
  assert.doesNotMatch(text, /s3cret-value/);
});

await test('describeDbError treats an unknown database like a mismatch', () => {
  const error = Object.assign(new Error('database "shop" does not exist'), { code: '3D000' });
  assert.match(describeDbError(error, URL_WITH_SECRET), /first created with/);
});

await test('describeDbError asks to start Postgres when the connection is refused', () => {
  const error = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
  assert.match(describeDbError(error, URL_WITH_SECRET), /pnpm infra:up/);
});

await test('checkDatabase reports a stopped Postgres using the real driver', async () => {
  const port = await closedPort();
  const problem = await checkDatabase(
    `postgres://shop:s3cret-value@127.0.0.1:${String(port)}/shop`,
  );
  assert.match(problem ?? '', /not reachable.*pnpm infra:up/);
  assert.doesNotMatch(problem ?? '', /s3cret-value/);
});

await test('checkDatabase skips the check when the driver is not installed', async () => {
  assert.equal(await checkDatabase(URL_WITH_SECRET, () => null), null);
});
