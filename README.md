# nodejs-shop

A production-grade e-commerce shop for the Ukrainian market: a NestJS modular monolith with
Next.js storefront and admin apps, in a pnpm + Turborepo monorepo.
See [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md) for scope, stack, and roadmap.

## Getting started

Requirements: Node.js 26 (version in `.nvmrc`) and pnpm (version pinned in `package.json`).

```sh
nvm use          # or fnm use / volta; any tool that reads .nvmrc
pnpm install     # also installs the git hooks
pnpm lint
pnpm typecheck
```

## Repository layout

```
apps/        api, storefront, admin (added in Phase 0 steps 4–5)
packages/    config-ts, config-eslint (shared tooling); contracts, api-client, ui to follow
docs/        project brief, ADRs, vendor API docs, runbooks
```

## Contributing

Every change goes through an issue and a pull request. Commits follow
[Conventional Commits](https://www.conventionalcommits.org/) with a required scope, e.g.
`feat(cart): merge guest cart on login`. See [`CLAUDE.md`](CLAUDE.md) for the full rules.
