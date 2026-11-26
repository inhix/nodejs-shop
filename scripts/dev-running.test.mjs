import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  describeRunningDev,
  findNextDevServers,
  readNextDevLock,
  readState,
  removeState,
  slotPorts,
  writeState,
} from './dev-ports.mjs';

/** @returns {Promise<number>} the PID of a process that has already exited */
async function deadPid() {
  const child = spawn(process.execPath, ['-e', '']);
  await new Promise((resolve) => child.once('exit', resolve));
  if (child.pid === undefined) throw new Error('no pid');
  return child.pid;
}

/** @returns {Promise<string>} */
function tempDir() {
  return mkdtemp(join(tmpdir(), 'shop-dev-test-'));
}

/** @param {number} pid */
function state(pid) {
  return { pid, ...slotPorts(0), startedAt: '2026-11-26T00:00:00.000Z' };
}

/**
 * Writes apps/<app>/.next/dev/lock the way Next.js 16 does.
 * @param {string} appsDir
 * @param {string} app
 * @param {string} content
 */
async function writeLock(appsDir, app, content) {
  const dir = join(appsDir, app, '.next', 'dev');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'lock'), content);
}

await test('readState returns a live run and ignores a dead one', async () => {
  const file = join(await tempDir(), 'ports.json');
  await writeState(state(process.pid), file);
  assert.equal((await readState(file))?.pid, process.pid);

  await writeFile(file, JSON.stringify(state(await deadPid())));
  assert.equal(await readState(file), null);
});

await test('writeState refuses to replace the record of another live run', async () => {
  const file = join(await tempDir(), 'ports.json');
  await writeState(state(process.pid), file);
  await assert.rejects(writeState(state(process.pid + 1), file), /already running/);
  assert.equal((await readState(file))?.pid, process.pid);
});

await test('writeState replaces the record of a run that has exited', async () => {
  const file = join(await tempDir(), 'ports.json');
  await writeFile(file, JSON.stringify(state(await deadPid())));
  await writeState(state(process.pid), file);
  assert.equal((await readState(file))?.pid, process.pid);
});

await test('removeState deletes only the record of the given PID', async () => {
  const file = join(await tempDir(), 'ports.json');
  await writeState(state(process.pid), file);
  await removeState(process.pid + 1, file);
  assert.equal((await readState(file))?.pid, process.pid);
  await removeState(process.pid, file);
  await assert.rejects(readFile(file, 'utf8'), { code: 'ENOENT' });
});

await test('readNextDevLock reads the Next.js 16 lock format and checks the PID', async () => {
  const appsDir = await tempDir();
  // Format observed in Next.js 16.4.6 (.next/dev/lock). If Next changes it, this fails.
  await writeLock(
    appsDir,
    'storefront',
    JSON.stringify({
      pid: process.pid,
      port: 3001,
      hostname: 'localhost',
      appUrl: 'http://localhost:3001',
      startedAt: 1795654331717,
    }),
  );
  assert.deepEqual(await readNextDevLock(join(appsDir, 'storefront', '.next', 'dev', 'lock')), {
    pid: process.pid,
    url: 'http://localhost:3001',
  });
});

await test('findNextDevServers ignores stale, unreadable and missing locks', async () => {
  const appsDir = await tempDir();
  await writeLock(
    appsDir,
    'storefront',
    JSON.stringify({ pid: await deadPid(), appUrl: 'http://localhost:3001' }),
  );
  await writeLock(appsDir, 'admin', 'not json');
  assert.deepEqual(await findNextDevServers(appsDir), []);

  await writeLock(
    appsDir,
    'admin',
    JSON.stringify({ pid: process.pid, appUrl: 'http://localhost:3002' }),
  );
  assert.deepEqual(await findNextDevServers(appsDir), [
    { app: 'admin', pid: process.pid, url: 'http://localhost:3002' },
  ]);
});

await test('describeRunningDev prints the links and how to stop a running pnpm dev', () => {
  const message = describeRunningDev(state(4242), []);
  assert.match(message ?? '', /Already running in this checkout \(pnpm dev, PID 4242\)/);
  assert.match(message ?? '', /Admin\s+http:\/\/127\.0\.0\.1:3002/);
  assert.match(message ?? '', /kill 4242/);
});

await test('describeRunningDev names next dev servers started without pnpm dev', () => {
  const message = describeRunningDev(null, [
    { app: 'storefront', pid: 11, url: 'http://localhost:3001' },
    { app: 'admin', pid: 12, url: 'http://localhost:3002' },
  ]);
  assert.match(message ?? '', /Storefront\s+http:\/\/localhost:3001 {2}\(next dev, PID 11\)/);
  assert.match(message ?? '', /kill 11 12/);
});

await test('describeRunningDev returns null when nothing runs', () => {
  assert.equal(describeRunningDev(null, []), null);
});
