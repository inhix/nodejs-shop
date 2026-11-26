// Port selection for local development (`pnpm dev`). Node built-ins only.
import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { dirname, join } from 'node:path';

/** Apps started by `pnpm dev` and their offset inside a slot. */
export const APP_OFFSETS = Object.freeze({ api: 0, storefront: 1, admin: 2 });

export const BASE_PORT = 3000;
export const SLOT_STEP = 100;
export const MAX_SLOTS = 10;

/** Written by `pnpm dev`, read by `pnpm dev:urls`. Lives under node_modules, so it is never committed. */
export const STATE_FILE = join(
  import.meta.dirname,
  '..',
  'node_modules',
  '.cache',
  'shop-dev',
  'ports.json',
);

/**
 * @typedef {{ api: number, storefront: number, admin: number }} SlotPorts
 * @typedef {{ pid: number, api: number, storefront: number, admin: number, startedAt: string }} DevState
 * @typedef {{ pid: number, command: string }} PortOwner
 * @typedef {{ app: string, pid: number, url: string }} NextDevServer
 */

/**
 * @param {number} slot zero-based slot index
 * @returns {SlotPorts}
 */
export function slotPorts(slot) {
  const base = BASE_PORT + slot * SLOT_STEP;
  return {
    api: base + APP_OFFSETS.api,
    storefront: base + APP_OFFSETS.storefront,
    admin: base + APP_OFFSETS.admin,
  };
}

/**
 * Returns the first slot whose ports are all free, or null when none of the slots is.
 * @param {(port: number) => Promise<boolean>} isFree
 * @param {number} [maxSlots]
 * @returns {Promise<{ slot: number, ports: SlotPorts } | null>}
 */
export async function pickSlot(isFree, maxSlots = MAX_SLOTS) {
  for (let slot = 0; slot < maxSlots; slot += 1) {
    const ports = slotPorts(slot);
    const results = await Promise.all(Object.values(ports).map((port) => isFree(port)));
    if (results.every(Boolean)) return { slot, ports };
  }
  return null;
}

// The host cannot bind this address family (e.g. IPv6 disabled): says nothing about the port.
const NOT_APPLICABLE = new Set(['EADDRNOTAVAIL', 'EAFNOSUPPORT']);

/**
 * @param {number} port
 * @param {string} host
 * @returns {Promise<boolean>} true when the port can be bound on this host
 */
function canBind(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (/** @type {NodeJS.ErrnoException} */ error) => {
      resolve(error.code !== undefined && NOT_APPLICABLE.has(error.code));
    });
    server.listen({ port, host, exclusive: true }, () => {
      server.close(() => {
        resolve(true);
      });
    });
  });
}

/**
 * @param {number} port
 * @param {string} host
 * @returns {Promise<boolean>} true when something accepts connections on host:port
 */
function acceptsConnections(port, host) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      resolve(false);
    });
  });
}

/**
 * A port is free only if it can be bound on loopback, the IPv4 wildcard and the IPv6 wildcard,
 * and nothing answers on it. A single bind check is not enough: on macOS a listener on
 * 127.0.0.1 does not block binding the wildcard address, and the reverse.
 * @param {number} port
 * @returns {Promise<boolean>}
 */
export async function isPortFree(port) {
  for (const host of ['127.0.0.1', '0.0.0.0', '::']) {
    if (!(await canBind(port, host))) return false;
  }
  return !(await acceptsConnections(port, '127.0.0.1'));
}

/**
 * Best effort: the process listening on a port, via lsof (macOS, most Linux). Null if unknown.
 * @param {number} port
 * @returns {Promise<PortOwner | null>}
 */
export function findPortOwner(port) {
  return new Promise((resolve) => {
    execFile('lsof', ['-nP', `-iTCP:${String(port)}`, '-sTCP:LISTEN', '-Fpc'], (error, stdout) => {
      const pid = error ? undefined : /^p(\d+)$/m.exec(stdout)?.[1];
      const command = error ? undefined : /^c(.+)$/m.exec(stdout)?.[1];
      resolve(pid && command ? { pid: Number(pid), command } : null);
    });
  });
}

/**
 * Records the running `pnpm dev`. Refuses to replace the record of another live run.
 * @param {DevState} state
 * @param {string} [file]
 * @returns {Promise<void>}
 */
export async function writeState(state, file = STATE_FILE) {
  const current = await readState(file);
  if (current && current.pid !== state.pid) {
    throw new Error(`pnpm dev (PID ${String(current.pid)}) is already running in this checkout`);
  }
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(state, null, 2)}\n`);
}

/**
 * @param {string} [file]
 * @returns {Promise<DevState | null>} the state of the running `pnpm dev`, or null
 */
export async function readState(file = STATE_FILE) {
  /** @type {unknown} */
  let data;
  try {
    data = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    // Missing or unreadable (e.g. a crash mid-write): treat as not running.
    return null;
  }
  if (!isDevState(data) || !isProcessAlive(data.pid)) return null;
  return data;
}

/** @returns {Promise<void>} */
/**
 * Deletes the record, but only if it belongs to `pid`: never the record of another run.
 * @param {number} pid
 * @param {string} [file]
 * @returns {Promise<void>}
 */
export async function removeState(pid, file = STATE_FILE) {
  /** @type {unknown} */
  let data;
  try {
    data = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return;
  }
  if (isDevState(data) && data.pid === pid) await rm(file, { force: true });
}

/** Next.js apps started by `pnpm dev`, with their labels in the links. */
export const NEXT_APPS = Object.freeze({ storefront: 'Storefront', admin: 'Admin' });

/**
 * Next.js 16 allows one `next dev` per app folder, on any port, and records it in
 * `.next/dev/lock` as JSON (`pid`, `appUrl`, ...). That format is internal to Next.js, so this
 * is best effort: a missing, unreadable or stale lock (Next leaves it behind on exit) is null.
 * @param {string} lockFile
 * @returns {Promise<{ pid: number, url: string } | null>}
 */
export async function readNextDevLock(lockFile) {
  /** @type {unknown} */
  let data;
  try {
    data = JSON.parse(await readFile(lockFile, 'utf8'));
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const record = /** @type {Record<string, unknown>} */ (data);
  const { pid, appUrl } = record;
  if (typeof pid !== 'number' || !Number.isInteger(pid) || typeof appUrl !== 'string') return null;
  return isProcessAlive(pid) ? { pid, url: appUrl } : null;
}

/**
 * @param {string} [appsDir] the repo's apps/ folder
 * @returns {Promise<NextDevServer[]>} the live `next dev` servers of this checkout
 */
export async function findNextDevServers(appsDir = join(import.meta.dirname, '..', 'apps')) {
  const found = await Promise.all(
    Object.keys(NEXT_APPS).map(async (app) => {
      const lock = await readNextDevLock(join(appsDir, app, '.next', 'dev', 'lock'));
      return lock ? { app, ...lock } : null;
    }),
  );
  return found.filter((server) => server !== null);
}

/**
 * A second `pnpm dev` in the same checkout cannot work: Next.js refuses a second `next dev`
 * per app folder. Describes the run that is already going, or returns null when there is none.
 * @param {DevState | null} state the live `pnpm dev` of this checkout
 * @param {NextDevServer[]} nextServers live `next dev` servers of this checkout
 * @returns {string | null}
 */
export function describeRunningDev(state, nextServers) {
  if (state) {
    return [
      `[dev] Already running in this checkout (pnpm dev, PID ${String(state.pid)}):`,
      formatLinks(state),
      `Stop it with Ctrl+C in its terminal, or: kill ${String(state.pid)}`,
    ].join('\n');
  }
  if (nextServers.length === 0) return null;
  const rows = nextServers.map((server) => {
    const label = NEXT_APPS[/** @type {keyof typeof NEXT_APPS} */ (server.app)];
    return `  ${label.padEnd(11)} ${server.url}  (next dev, PID ${String(server.pid)})`;
  });
  const pids = nextServers.map((server) => String(server.pid)).join(' ');
  return [
    '[dev] Already running in this checkout:',
    ...rows,
    `Stop ${nextServers.length === 1 ? 'it' : 'them'} with Ctrl+C in its terminal, or: kill ${pids}`,
  ].join('\n');
}

/**
 * @param {unknown} data
 * @returns {data is DevState}
 */
function isDevState(data) {
  if (typeof data !== 'object' || data === null) return false;
  const record = /** @type {Record<string, unknown>} */ (data);
  return (
    Number.isInteger(record.pid) &&
    Number.isInteger(record.api) &&
    Number.isInteger(record.storefront) &&
    Number.isInteger(record.admin) &&
    typeof record.startedAt === 'string'
  );
}

/**
 * @param {number} pid
 * @returns {boolean}
 */
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists but belongs to another user.
    return /** @type {NodeJS.ErrnoException} */ (error).code === 'EPERM';
  }
}

/**
 * @param {SlotPorts} ports
 * @returns {{ api: string, storefront: string, admin: string }}
 */
export function appUrls(ports) {
  return {
    api: `http://127.0.0.1:${String(ports.api)}`,
    storefront: `http://127.0.0.1:${String(ports.storefront)}`,
    admin: `http://127.0.0.1:${String(ports.admin)}`,
  };
}

/**
 * @param {string} baseUrl
 * @returns {Promise<boolean>} true when GET <baseUrl>/health/live answers 2xx within 1 s
 */
export async function isAppUp(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/health/live`, { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * @param {SlotPorts} ports
 * @returns {string} the block of links printed by `pnpm dev` and `pnpm dev:urls`
 */
export function formatLinks(ports) {
  const urls = appUrls(ports);
  return [
    `  API         ${urls.api}`,
    `  Storefront  ${urls.storefront}`,
    `  Admin       ${urls.admin}`,
  ].join('\n');
}
