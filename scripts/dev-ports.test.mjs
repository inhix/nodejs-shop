import assert from 'node:assert/strict';
import net from 'node:net';
import { test } from 'node:test';

import { formatLinks, isPortFree, pickSlot, slotPorts } from './dev-ports.mjs';

/**
 * Listens on an OS-assigned port on the given host.
 * @param {string} host
 * @returns {Promise<{ port: number, close: () => Promise<void> }>}
 */
function listen(host) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen({ port: 0, host }, () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('no port'));
        return;
      }
      resolve({
        port: address.port,
        close: () =>
          new Promise((done) => {
            server.close(() => {
              done();
            });
          }),
      });
    });
  });
}

/**
 * @param {Iterable<number>} busyPorts
 * @returns {(port: number) => Promise<boolean>}
 */
function freeExcept(busyPorts) {
  const busy = new Set(busyPorts);
  return (port) => Promise.resolve(!busy.has(port));
}

await test('slotPorts starts at 3000/3001 and steps by 100', () => {
  assert.deepEqual(slotPorts(0), { api: 3000, storefront: 3001 });
  assert.deepEqual(slotPorts(1), { api: 3100, storefront: 3101 });
  assert.deepEqual(slotPorts(4), { api: 3400, storefront: 3401 });
});

await test('pickSlot uses the default slot when its ports are free', async () => {
  assert.deepEqual(await pickSlot(freeExcept([])), { slot: 0, ports: slotPorts(0) });
});

await test('pickSlot moves the whole slot when only one of its ports is busy', async () => {
  const picked = await pickSlot(freeExcept([3001]));
  assert.deepEqual(picked, { slot: 1, ports: { api: 3100, storefront: 3101 } });
});

await test('pickSlot keeps stepping by 100 while slots are busy', async () => {
  const picked = await pickSlot(freeExcept([3000, 3101, 3200]));
  assert.deepEqual(picked, { slot: 3, ports: { api: 3300, storefront: 3301 } });
});

await test('pickSlot returns null when every slot is busy', async () => {
  assert.equal(await pickSlot(() => Promise.resolve(false), 3), null);
});

await test('isPortFree reports a listener on 127.0.0.1 as busy', async () => {
  const server = await listen('127.0.0.1');
  try {
    assert.equal(await isPortFree(server.port), false);
  } finally {
    await server.close();
  }
});

await test('isPortFree reports a listener on the IPv6 wildcard as busy (what next dev binds)', async () => {
  const server = await listen('::');
  try {
    assert.equal(await isPortFree(server.port), false);
  } finally {
    await server.close();
  }
});

await test('isPortFree reports a port as free once its listener is gone', async () => {
  const server = await listen('127.0.0.1');
  await server.close();
  assert.equal(await isPortFree(server.port), true);
});

await test('formatLinks lists the API and storefront URLs of the slot', () => {
  const links = formatLinks(slotPorts(1));
  assert.match(links, /API\s+http:\/\/127\.0\.0\.1:3100/);
  assert.match(links, /Storefront\s+http:\/\/127\.0\.0\.1:3101/);
});
