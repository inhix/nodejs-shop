# nodejs-shop

[![CI](https://github.com/inhix/nodejs-shop/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/inhix/nodejs-shop/actions/workflows/ci.yml)

A production-grade e-commerce shop for the Ukrainian market: a NestJS modular monolith with
Next.js storefront and admin apps, in a pnpm + Turborepo monorepo.
See [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md) for scope, stack, and roadmap.

## Getting started

New machine with nothing installed? Follow [`docs/getting-started.md`](docs/getting-started.md):
it covers installing the tools on macOS, Linux, and Windows (WSL2), checking that everything
works, and troubleshooting.

Requirements: Node.js 26 (version in `.nvmrc`), pnpm (version pinned in `package.json`), and
Docker with Docker Compose.

```sh
nvm use            # or fnm use / volta; any tool that reads .nvmrc
pnpm install       # also installs the git hooks
cp .env.example .env
pnpm infra:up      # Postgres and Redis on localhost, waits until healthy
pnpm lint
pnpm typecheck
pnpm dev           # API :3000, storefront :3001, admin :3002 (or the next free slot, see below)
```

`pnpm dev` picks free ports: if any of 3000-3002 is taken by another checkout or program, it uses
3100-3102, then 3200-3202, and prints the links in the console. `pnpm dev:urls` shows them again.
If this checkout already runs `pnpm dev` (or a frontend's `next dev`), a second `pnpm dev` starts
nothing: it prints the running links and how to stop that run, because Next.js allows only one
dev server per app folder.

Check the API with `curl http://127.0.0.1:3000/health/ready`: it reports Postgres and Redis
separately and returns 503 when Postgres is unreachable.

`pnpm infra:down` stops the containers and keeps data. `pnpm infra:reset` stops them and
**deletes** the local database volume.

## Repository layout

```
apps/        api (NestJS), storefront and admin (Next.js)
packages/    contracts (Zod + OpenAPI), api-client (generated), config-ts, config-eslint; ui to follow
docs/        project brief, ADRs, vendor API docs, runbooks
```

## Contributing

Every change goes through an issue and a pull request. Commits follow
[Conventional Commits](https://www.conventionalcommits.org/) with a required scope, e.g.
`feat(cart): merge guest cart on login`. See [`CLAUDE.md`](CLAUDE.md) for the full rules.
