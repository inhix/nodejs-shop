# 0003. NestJS on the Fastify adapter

- Status: Accepted
- Date: 2026-11-25

## Context

The API holds all business logic: payments, webhooks, checkout with locking, background
jobs. Much of the code is written in AI-assisted sessions and reviewed by others, so a
consistent structure matters more than freedom. External providers (payments, shipping,
fiscalization) must sit behind interfaces with test fakes.

## Decision

NestJS with the Fastify HTTP adapter, as an ES module project.

- Dependency injection, modules, guards and pipes give every feature the same shape and
  make provider interfaces and fakes natural.
- Fastify instead of Express: faster, schema-aware, and its `inject()` lets HTTP tests run
  without opening a port.
- Compiled with `tsc` (Nest CLI's tsc builder). Nest's DI reads constructor parameter types
  from decorator metadata (`emitDecoratorMetadata`), which only the TypeScript compiler
  (and SWC) emit. Type-stripping runners such as tsx, esbuild or Node's built-in TypeScript
  support drop it, so they cannot run Nest. Vitest's transform does emit it; a test guards
  this.
- HTTP conventions: RFC 9457 Problem Details through one global exception filter, request ID
  from Fastify (`x-request-id`), structured Pino logs, config validated with Zod at startup.

## Consequences

- Features look alike, which helps review and keeps AI-generated code consistent.
- More ceremony than a minimal framework (modules, providers, decorators).
- Some Nest ecosystem packages assume Express; each Fastify-specific gap is solved locally.
- Builds use `tsc`, which is slower than esbuild-based tools; acceptable for one API.
- Nest relies on legacy (experimental) decorators. Moving to standard decorators would be a
  Nest-wide change and a new ADR.

## Alternatives considered

- **Express, Fastify or Hono alone:** lighter and faster to start, but every structural
  choice (DI, module layout, validation, error handling) would be ours to invent and keep
  consistent.
- **AdonisJS:** full-featured and structured, but a smaller ecosystem and fewer people
  familiar with it.
- **NestJS on Express (default):** works, but slower, and no built-in `inject()` testing.
