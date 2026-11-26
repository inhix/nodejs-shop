// `pnpm dev`: picks free ports for the apps, then runs `turbo run dev` with them.
// Slots are tried in order: 3000-3002, 3100-3102, 3200-3202, ... The API, storefront and admin
// always share a slot, and both frontends get the matching API_URL. Extra arguments go to turbo.
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import {
  appUrls,
  findPortOwner,
  formatLinks,
  isAppUp,
  isPortFree,
  MAX_SLOTS,
  pickSlot,
  removeState,
  slotPorts,
  writeState,
} from './dev-ports.mjs';
import { checkDatabase, checkEnv, loadDevEnv } from './dev-checks.mjs';

const READY_TIMEOUT_MS = 180_000;
const READY_POLL_MS = 1_000;

/** Explains why the default ports were skipped; a busy port is often a forgotten copy of the app. */
async function reportBusyDefaults() {
  for (const [app, port] of Object.entries(slotPorts(0))) {
    if (await isPortFree(port)) continue;
    const owner = await findPortOwner(port);
    const by = owner ? ` by ${owner.command} (PID ${String(owner.pid)})` : '';
    console.warn(
      `[dev] Port ${String(port)} (${app}) is in use${by}. Is another copy of this app running?`,
    );
  }
}

/**
 * Prints the links once every app answers its health check.
 * @param {import('./dev-ports.mjs').SlotPorts} ports
 * @param {() => boolean} isStopped
 */
async function announceWhenReady(ports, isStopped) {
  const urls = Object.values(appUrls(ports));
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (!isStopped() && Date.now() < deadline) {
    const up = await Promise.all(urls.map((url) => isAppUp(url)));
    if (up.every(Boolean)) {
      if (!isStopped()) console.log(`\n[dev] Ready:\n${formatLinks(ports)}\n`);
      return;
    }
    await sleep(READY_POLL_MS);
  }
  if (!isStopped()) {
    console.warn(
      '[dev] Not every app answered its health check yet. Run `pnpm dev:urls` to check.',
    );
  }
}

/**
 * The API cannot work without a database it can log in to; say how to fix it before starting.
 * @returns {Promise<string | null>} what to fix, or null when the setup is usable
 */
async function checkSetup() {
  const { env, hasEnvFile } = loadDevEnv();
  const envProblem = checkEnv(env, hasEnvFile);
  if (envProblem !== null || env.DATABASE_URL === undefined) return envProblem;
  return checkDatabase(env.DATABASE_URL);
}

async function main() {
  const problem = await checkSetup();
  if (problem) {
    console.error(`[dev] Cannot start: ${problem}`);
    process.exitCode = 1;
    return;
  }

  const picked = await pickSlot(isPortFree);
  if (!picked) {
    const last = slotPorts(MAX_SLOTS - 1);
    console.error(
      `[dev] No free ports between ${String(slotPorts(0).api)} and ${String(last.admin)}. ` +
        'Stop other dev servers (`pnpm dev:urls` shows this checkout’s) and try again.',
    );
    process.exitCode = 1;
    return;
  }
  const { slot, ports } = picked;
  if (slot > 0) await reportBusyDefaults();
  console.log(`[dev] Starting with:\n${formatLinks(ports)}\n`);

  await writeState({ pid: process.pid, ...ports, startedAt: new Date().toISOString() });

  const turbo = join(import.meta.dirname, '..', 'node_modules', '.bin', 'turbo');
  const child = spawn(turbo, ['run', 'dev', ...process.argv.slice(2)], {
    stdio: 'inherit',
    // Own process group, so one signal reaches turbo and every app. turbo's Node wrapper does not
    // forward signals to the native binary, so signalling only the direct child would leave the
    // apps running when the launcher is stopped by anything other than Ctrl+C in a terminal.
    detached: true,
    env: {
      ...process.env,
      // Real environment variables win over the root .env in both apps (see their dev scripts).
      PORT: String(ports.api),
      API_URL: appUrls(ports).api,
      STOREFRONT_PORT: String(ports.storefront),
      ADMIN_PORT: String(ports.admin),
    },
  });

  let stopped = false;
  let exited = false;
  /** @param {NodeJS.Signals} signal */
  const stopGroup = (signal) => {
    if (exited || child.pid === undefined) return;
    try {
      // A negative PID signals the whole process group (POSIX).
      process.kill(-child.pid, signal);
    } catch {
      // The group is already gone.
    }
  };
  for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM', 'SIGHUP'])) {
    process.on(signal, () => {
      stopped = true;
      stopGroup(signal);
    });
  }
  // Never leave the apps behind if the launcher itself exits first.
  process.on('exit', () => {
    stopGroup('SIGTERM');
  });

  child.once('exit', (code, signal) => {
    stopped = true;
    exited = true;
    void removeState().finally(() => {
      process.exitCode = code ?? (signal ? 1 : 0);
    });
  });
  child.once('error', (error) => {
    stopped = true;
    console.error(`[dev] Could not start turbo: ${error.message}`);
    void removeState().finally(() => {
      process.exitCode = 1;
    });
  });

  await announceWhenReady(ports, () => stopped);
}

await main();
