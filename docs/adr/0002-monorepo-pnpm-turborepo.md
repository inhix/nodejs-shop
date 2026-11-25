# 0002. Monorepo with pnpm workspaces and Turborepo

- Status: Accepted
- Date: 2026-11-25

## Context

The system has three apps (API, storefront, admin) that must agree on request and response
shapes, plus shared configuration (TypeScript, ESLint) and shared packages (contracts,
generated API client, UI). Changes often span the API and a frontend at once, and every
change goes through one PR with CI.

## Decision

One repository with pnpm workspaces (`apps/*`, `packages/*`) and Turborepo as task runner.

- pnpm and Node versions are pinned: `packageManager`, `.nvmrc`, `engines` with
  `engineStrict`.
- Versions shared by several packages live in the pnpm `catalog`; all versions are exact
  (`saveExact`).
- Supply chain: pnpm resolves only versions published at least 7 days ago
  (`minimumReleaseAge`), and dependency install scripts run only when allowed in
  `allowBuilds`.
- Turborepo runs `build`, `lint`, `typecheck` and `test` in dependency order with caching;
  `turbo prune --docker` produces minimal Docker build contexts.

## Consequences

- A contract change and the code using it land in the same PR, checked by the same CI run.
- One lockfile and one set of tooling versions for everything.
- pnpm's strict `node_modules` layout catches undeclared dependencies that npm or Yarn
  classic would hide.
- CI runs for the whole repo on every PR. Turborepo caching keeps this fast while the repo
  is small; remote caching can be added if it gets slow.
- New contributors need pnpm and the pinned Node version (`nvm use`).

## Alternatives considered

- **Separate repositories per app:** shared types would need publishing and versioning, and
  cross-app changes would need coordinated PRs.
- **Nx:** more features (generators, module boundary lint rules, affected graph), but more
  configuration and conventions to learn. Turborepo covers what this project needs.
- **npm or Yarn workspaces:** work, but npm is slower and less strict, and Yarn Berry's
  Plug'n'Play has compatibility friction with some tools. pnpm also provides the catalog
  and supply-chain settings used above.
