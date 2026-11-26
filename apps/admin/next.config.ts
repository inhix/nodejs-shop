import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

// The monorepo root: standalone output must trace files outside this app (workspace packages).
const repoRoot = join(import.meta.dirname, '../..');

/** Staff-only app: search engines must not index any response, including non-HTML files. */
export const NOINDEX_HEADER = { key: 'X-Robots-Tag', value: 'noindex, nofollow' };

export default function config(phase: string): NextConfig {
  // Local development shares the repo root .env with the API and Docker Compose. Next only
  // reads .env files next to the app, so load it here. Variables already set win.
  // Builds and the Docker image never read a .env file.
  const rootEnv = join(repoRoot, '.env');
  if (phase === PHASE_DEVELOPMENT_SERVER && existsSync(rootEnv)) {
    process.loadEnvFile(rootEnv);
  }

  return {
    // Self-contained server in .next/standalone, used by the Docker image.
    output: 'standalone',
    outputFileTracingRoot: repoRoot,
    turbopack: { root: repoRoot },
    poweredByHeader: false,
    // Agent rules live in the repo's CLAUDE.md; stop `next dev` from writing AGENTS.md.
    agentRules: false,
    headers: () => Promise.resolve([{ source: '/:path*', headers: [NOINDEX_HEADER] }]),
  };
}
