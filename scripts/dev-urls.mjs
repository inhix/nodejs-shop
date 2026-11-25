// `pnpm dev:urls`: prints the links of the `pnpm dev` running in this checkout.
import { appUrls, findPortOwner, isAppUp, readState, slotPorts } from './dev-ports.mjs';

async function main() {
  const state = await readState();
  if (!state) {
    console.log('`pnpm dev` is not running in this checkout. Start it with `pnpm dev`.');
    for (const [app, port] of Object.entries(slotPorts(0))) {
      const owner = await findPortOwner(port);
      if (owner) {
        console.log(
          `Note: port ${String(port)} (${app}) is used by ${owner.command} (PID ${String(owner.pid)}).`,
        );
      }
    }
    return;
  }

  const urls = appUrls(state);
  const rows = await Promise.all(
    Object.entries(urls).map(async ([app, url]) => {
      const status = (await isAppUp(url)) ? 'up' : 'starting or down';
      return `  ${app.padEnd(11)} ${url}  (${status})`;
    }),
  );
  console.log(
    `pnpm dev (PID ${String(state.pid)}), started ${state.startedAt}:\n${rows.join('\n')}`,
  );
}

await main();
