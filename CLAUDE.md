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
- Tests: Vitest, Fastify `inject()` for HTTP, Testcontainers, MSW/nock, Playwright, k6

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
  COD orders skip pending_payment; uncollected COD parcels end as returned.
  Terminal states: cancelled, refunded, returned.
- Stock reservation runs inside a transaction with row locking (Drizzle `.for('update')`).
  Reservations expire via a scheduled job.
- Payment status changes only from verified webhooks, never from client redirects.
  A scheduled reconciliation job checks orders stuck in pending_payment with the provider,
  in case a webhook was lost.
- Webhooks: verify signatures on the raw body with constant-time comparison, store processed
  event IDs for idempotency, and ignore stale updates (compare provider modification time).
- Webhook handlers stay fast: verify, record the state change, write outbox events, respond.
  Never call external services (Checkbox, SES, Nova Poshta) inside a webhook handler.
- Never retry a customer-initiated payment automatically. A failed payment is retried only
  by the customer's own action (same card, another card, or switching to COD).
- Side effects of state changes (emails, fiscal receipts, stock updates) go through the
  transactional outbox and queued jobs. A failing external service must never block or lose
  an order.
- Every card payment produces a Checkbox fiscal receipt; every refund produces a return receipt.
- Products are soft-deleted. IDs are UUIDv7. Every table has created_at and updated_at.
- Phone numbers are stored in E.164 (`+380...`). Default locale is `uk`, second is `en`.

## Direct calls vs. the queue

Rule of thumb: if a person is waiting for the result, call the external service directly and
handle failure clearly; if the work is a consequence of something that already happened, put
it on a BullMQ queue.

- Direct: creating a payment invoice (the customer needs the payment link now); creating a
  single Nova Poshta waybill from the admin panel (falls back to the queue if Nova Poshta is down).
- Queued: fiscal receipts, emails, Nova Poshta directory sync, shipment tracking, payment
  reconciliation, reservation expiry, refunds initiated by staff, bulk waybill creation.
- Checkout reads Nova Poshta cities and branches from the local Postgres copy, never from the
  live API.
- Queued jobs are idempotent, use bounded retries with backoff, and leave failed jobs visible.

## Code conventions

- TypeScript strict. No `any`, no `@ts-ignore`. Non-null assertions need a comment explaining why.
- Validate every external input with Zod at the boundary (HTTP, webhooks, queue jobs, env).
- Reuse schemas from `packages/contracts`; do not redefine request/response shapes locally.
- Every API route is in the OpenAPI document in `packages/contracts/src/openapi.ts`. After a
  contract change run `pnpm generate` and commit the generated files; tests fail otherwise.
- Config is validated with Zod at startup; the app must refuse to boot on invalid config.
- API errors use RFC 9457 Problem Details via the global exception filter.
- Logging: Pino, structured, with request ID. Never log secrets, tokens, card data, or full PII.
- Named exports only, except where a framework requires default exports (Next.js pages).
- Next.js changes quickly: before writing Next.js code, check the docs bundled with the installed
  version in `apps/<app>/node_modules/next/dist/docs/` instead of relying on memory.
- Prefer small, focused functions and explicit types on public module APIs.

## Database

- Schema changes go through Drizzle migrations that are generated and committed.
- Never edit a migration that has been merged. Create a new one.
- Migrations never run on app startup; they run as a separate deploy step.
- Add indexes for every foreign key and for query patterns you introduce.

## Docker and versions

- Each app's Dockerfile is added in the same PR that creates the app.
- Dockerfiles use multi-stage builds, `turbo prune --docker`, a pinned Node 26 base image
  (exact version, never `latest`), and a non-root user in the final stage.
- Next.js apps use `output: 'standalone'`. The API and worker share one image, started with
  different commands.
- Keep a `.dockerignore` that excludes `node_modules`, `.env*` (except `.env.example`), and `.git`.
- Postgres and Redis use the same pinned major versions in Docker Compose, Testcontainers,
  and AWS. Never use `latest` image tags anywhere.
- During development, apps run with `pnpm dev`; Docker Compose runs only infrastructure
  (Postgres, Redis). Local AWS emulation (S3, SES) is decided in an ADR when first needed.

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
- Security tooling (see `SECURITY.md`): CodeQL, Trivy image scan, dependency review, Renovate.
  Do not disable a finding to pass CI; fix it, or add it to `.trivyignore` with a reason and
  expiry date after asking.

## Workflow

- One issue -> one branch -> one PR. Branch names: `feat/...`, `fix/...`, `chore/...`, `docs/...`.
- Every PR description references its issue with `Closes #N` and follows the PR template.
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

Run from the repo root. Node version comes from `.nvmrc`; pnpm version from `packageManager`.

```
pnpm install                      # install all workspaces (fails on the wrong Node version)
pnpm dev                          # run all apps in dev mode
pnpm build                        # build all packages and apps
pnpm lint                         # ESLint in every package, then root-level files
pnpm typecheck                    # tsc --noEmit in every package, then root-level files
pnpm test                         # tests in every package
pnpm format / pnpm format:check   # Prettier write / check (docs/ is excluded)
pnpm generate                     # rebuild openapi.json and the api-client types after a contract change
pnpm --filter <package> <script>  # run a script in one package, e.g. --filter @shop/config-eslint lint
pnpm infra:up                     # start Postgres and Redis, wait until healthy
pnpm infra:down                   # stop them (data kept)
pnpm infra:reset                  # stop them and DELETE local data volumes
pnpm --filter @shop/api dev       # API with reload on http://127.0.0.1:3000
pnpm --filter @shop/storefront dev   # storefront on http://127.0.0.1:3001
pnpm --filter @shop/api exec vitest run test/app.spec.ts   # a single test file
pnpm --filter @shop/api exec vitest run test/health.int.spec.ts   # integration (needs Docker)
docker build -f apps/api/Dockerfile -t shop-api .         # API image (from repo root)
docker build -f apps/storefront/Dockerfile -t shop-storefront .   # storefront image
```

CI (`.github/workflows/`): `verify` runs format check, lint, typecheck, test, and build on every
PR and push to `main`; `pr-title` runs commitlint on the PR title, because it becomes the squash
commit message. `docker-build` builds every app image in a matrix,
waits for each health check, then scans each image with Trivy. All three are required checks on `main`;
so are CodeQL (`codeql.yml`) and `dependency-review`. Actions are pinned by commit SHA. Renovate
(`renovate.json`) opens dependency update PRs weekly.

- Shared versions used by several packages live in the `catalog` in `pnpm-workspace.yaml`;
  reference them with `"catalog:"`.
- pnpm only installs package versions published at least 7 days ago (`minimumReleaseAge`).
- Git hooks: `pre-commit` runs lint-staged; `commit-msg` runs commitlint. The allowed commit
  scopes are listed in the `commitlint` field of the root `package.json`; add a scope there
  when introducing a new module or package.

Local infrastructure reads `.env` (copy `.env.example`). Image tags in `docker-compose.yml`
must stay in sync with Testcontainers and AWS.

To be added with later steps: migrations.
