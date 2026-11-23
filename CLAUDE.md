# CLAUDE.md

Guidance for Claude Code in this repository. These are rules, not suggestions.
Full context (stack rationale, roadmap, phases) lives in `docs/PROJECT_BRIEF.md`.
Architecture decisions live in `docs/adr/`. Read the relevant ones before changing an area.

## Project

A production-grade e-commerce shop for the Ukrainian market, built as a modular monolith
in a TypeScript monorepo. The code will be reviewed by senior developers: optimize for
correctness, clarity, and consistency over speed.

## Stack (summary)

- Runtime: Node.js 26 LTS, pnpm workspaces, Turborepo, TypeScript (strict)
- API: NestJS on the Fastify adapter
- Data: PostgreSQL + Drizzle ORM; Redis 7.x + BullMQ
- Contracts: Zod in `packages/contracts` -> OpenAPI -> generated client in `packages/api-client`
- Frontends: Next.js App Router (storefront, admin), Tailwind, shadcn/ui, React Hook Form
- Integrations: plata by mono + LiqPay (own clients), Checkbox (fiscal receipts), Nova Poshta
- Infra: AWS (ECS Fargate, RDS, ElastiCache for Redis OSS, S3/CloudFront, SES), Terraform
- Tests: Vitest, Supertest, Testcontainers, MSW/nock, Playwright, k6

## Repository layout

```
apps/api          NestJS API and BullMQ worker
apps/storefront   Next.js customer app
apps/admin        Next.js staff app
packages/contracts, api-client, ui, config-eslint, config-ts
infra/            Terraform
docs/             PROJECT_BRIEF.md, adr/, vendor/, runbooks/, architecture.md
```

## Architecture rules

- The API is a modular monolith. Modules: catalog, cart, checkout, orders, payments,
  inventory, users, shipping, fiscalization, notifications.
- A module never reads or writes another module's tables. Cross-module access goes through
  the other module's exported service or through domain events.
- Next.js apps only render UI and call the API through `packages/api-client`.
  No business logic, pricing, or direct database access in frontends.
- External providers sit behind interfaces: `PaymentProvider`, `ShippingProvider`,
  `FiscalProvider`. Business code depends on the interface, never on a concrete provider.
- Payment provider clients (monobank, LiqPay) are written in-house from official docs in
  `docs/vendor/`. Do not add third-party payment SDKs or wrappers.
- When working with an external API, read its docs in `docs/vendor/` first. Never guess
  endpoints, fields, or signature schemes from memory.

## Domain rules (non-negotiable)

- Money is an integer in minor units (kopiykas) plus an ISO currency code. Never floats.
- Prices and totals are always calculated server-side. Never trust client-sent amounts.
- Order items snapshot product name, SKU, and unit price at purchase time.
- Order status changes only through the order state machine in the orders module.
  Card orders: pending_payment -> paid -> fulfilling -> shipped -> delivered.
  COD orders skip pending_payment. Terminal states: cancelled, refunded.
- Stock reservation runs inside a transaction with row locking (Drizzle `.for('update')`).
  Reservations expire via a scheduled job.
- Payment status changes only from verified webhooks, never from client redirects.
- Webhooks: verify signatures on the raw body with constant-time comparison, store processed
  event IDs for idempotency, and ignore stale updates (compare provider modification time).
- Side effects of state changes (emails, fiscal receipts, stock updates) go through the
  transactional outbox and queued jobs. A failing external service must never block or lose
  an order.
- Every card payment produces a Checkbox fiscal receipt; every refund produces a return receipt.
- Products are soft-deleted. IDs are UUIDv7. Every table has created_at and updated_at.
- Phone numbers are stored in E.164 (`+380...`). Default locale is `uk`, second is `en`.

## Code conventions

- TypeScript strict. No `any`, no `@ts-ignore`. Non-null assertions need a comment explaining why.
- Validate every external input with Zod at the boundary (HTTP, webhooks, queue jobs, env).
- Reuse schemas from `packages/contracts`; do not redefine request/response shapes locally.
- Config is validated with Zod at startup; the app must refuse to boot on invalid config.
- API errors use RFC 9457 Problem Details via the global exception filter.
- Logging: Pino, structured, with request ID. Never log secrets, tokens, card data, or full PII.
- Named exports only, except where a framework requires default exports (Next.js pages).
- Prefer small, focused functions and explicit types on public module APIs.

## Database

- Schema changes go through Drizzle migrations that are generated and committed.
- Never edit a migration that has been merged. Create a new one.
- Migrations never run on app startup; they run as a separate deploy step.
- Add indexes for every foreign key and for query patterns you introduce.

## Redis

- Key naming: `<domain>:<id>` (e.g. `session:{id}`, `ratelimit:{ip}`).
- Every key that should expire has a TTL.
- The app degrades gracefully if Redis is unavailable; checkout must keep working.

## Testing

- Unit tests (Vitest) for services and pure logic.
- Integration tests use real Postgres and Redis via Testcontainers. Never mock the database
  in integration tests.
- External HTTP APIs are mocked with MSW or nock. Webhook tests use correctly signed payloads.
- Every new endpoint ships with an integration test, including authorization failures
  (e.g. user A cannot read user B's order).
- Checkout and payments must cover: concurrent purchase of the last item, duplicate webhooks,
  payment failure, reservation expiry, provider outage with retry.
- Do not weaken, skip, or delete a failing test to make CI pass. Fix the cause or ask.

## Security

- Authorization check on every resource access, not just authentication.
- Secrets never go in code, commits, or logs. Add new variables to `.env.example` with
  placeholder values.
- Session cookies: httpOnly, Secure, SameSite. Passwords hashed with Argon2.

## Workflow

- One issue -> one branch -> one PR. Branch names: `feat/...`, `fix/...`, `chore/...`, `docs/...`.
- For any non-trivial task: propose a plan first and wait for approval before implementing.
- Keep PRs small and reviewable (aim for under ~400 changed lines excluding generated files).
- Commits follow Conventional Commits with a scope: `feat(cart): merge guest cart on login`.
- Before finishing a task: lint, typecheck, and relevant tests must pass.
- Update docs when behavior changes. Significant technical decisions need a new ADR in
  `docs/adr/` (context, decision, consequences, alternatives considered).
- Do not add a dependency without stating why and what alternatives exist; wait for approval.
  Check the current stable version instead of relying on memory, and pin exact versions.
- If requirements are unclear or a rule here conflicts with the task, stop and ask.

## Safety

- Never run `terraform apply`, `terraform destroy`, or destructive `aws` commands.
  `terraform plan` is allowed.
- Never touch production resources or production data.
- Never force-push, rewrite history on `main`, or commit directly to `main`.
- Never commit `.env` files or credentials.

## Commands

To be filled in once the monorepo is scaffolded (dev, build, lint, typecheck, test,
single test file, migrations, docker compose).
