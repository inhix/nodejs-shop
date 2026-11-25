# Architecture Decision Records

An ADR records one significant technical decision: the situation, what we chose, what it
costs us, and what else we considered. Code shows *what* the system does; ADRs explain *why*
it is built this way, so a later reader (or reviewer) does not have to guess or re-argue it.

## Rules

- One decision per ADR, written with [`template.md`](template.md).
- Numbered in the order they are accepted: `NNNN-short-title.md`.
- An accepted ADR is never edited, except for typos and its Status line. When a decision
  changes, write a new ADR and mark the old one `Superseded by NNNN`.
- Write an ADR in the same PR as the change it decides, before or with the code.
- Status is one of: `Proposed`, `Accepted`, `Superseded by NNNN`, `Deprecated`.

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](0001-modular-monolith.md) | Modular monolith | Accepted |
| [0002](0002-monorepo-pnpm-turborepo.md) | Monorepo with pnpm workspaces and Turborepo | Accepted |
| [0003](0003-nestjs-on-fastify.md) | NestJS on the Fastify adapter | Accepted |
| [0004](0004-postgresql.md) | PostgreSQL as the database | Accepted |
| [0005](0005-drizzle-over-prisma.md) | Drizzle ORM over Prisma | Accepted |
| [0006](0006-redis-and-node-redis.md) | Redis 7.2 OSS with the node-redis client | Accepted |

Planned topics are listed in `docs/PROJECT_BRIEF.md`, section 11.
