# 0007. Contracts pipeline: Zod -> OpenAPI -> generated client

- Status: Accepted
- Date: 2026-11-25

## Context

The API and two Next.js apps must agree on every request and response shape. TypeScript
types disappear at runtime, so input still has to be validated, and the frontends must not
drift from what the API actually returns. Reviewers should see API changes in PR diffs, and
interactive API docs (Scalar) are planned for Phase 1.

## Decision

One source of truth in `packages/contracts`, flowing in one direction:

```
Zod schemas (packages/contracts)
  -> openapi.json (OpenAPI 3.1, built with zod-openapi, committed)
     -> src/generated/schema.ts (types, built with openapi-typescript, committed)
        -> createApiClient() in packages/api-client (openapi-fetch)
```

- **Schemas** are Zod 4. The API imports them for types now and for request validation once
  endpoints take input. Frontends import them for form validation.
- **`zod-openapi`** builds the OpenAPI document from Zod's own JSON Schema output and
  `.meta()`. Every API route is listed in the document.
- **`openapi-typescript`** generates types only, and **`openapi-fetch`** (about 6 KB) uses
  them for a typed `fetch` client: a wrong path, parameter or field is a compile error.
- **Generated files are committed** and formatted exactly as their generators write them
  (excluded from Prettier). `pnpm generate` rebuilds both.
- **Three tests guard against drift:**
  - `openapi.json` must equal what the schemas produce;
  - `schema.ts` must equal what `openapi.json` produces;
  - the API's registered routes must equal the paths in `openapi.json`, in both directions.

## Consequences

- A contract change is one PR touching schema, generated files, API and frontend together,
  and API changes are visible as diffs of `openapi.json`.
- Forgetting `pnpm generate`, or adding an endpoint without a contract, fails CI.
- OpenAPI is language-neutral, so a future mobile app or partner can generate its own client.
- The packages compile to `dist/`, because the API runs compiled JavaScript. Turborepo
  builds them first (`^build`), and `pnpm dev` runs them in watch mode.
- `openapi-typescript` 7.13.0 and `openapi-fetch` 0.17.0 were last released in February
  2026, and openapi-typescript declares TypeScript `^5.x` as its peer. It works with
  TypeScript 6.0.3 (pnpm prints a peer warning). If it stops working or is abandoned, the
  generator can be replaced without touching the contracts.

## Alternatives considered

- **Frontends import Zod schemas directly, no OpenAPI:** simpler, but no API docs, no
  language-neutral contract, and no client paths or status codes in types.
- **`@nestjs/swagger` (OpenAPI from controller decorators):** ties the contract to Nest
  classes; the frontends would depend on the API's code, and the API, not the contract,
  would be the source of truth.
- **`@asteasolutions/zod-to-openapi`:** popular, but needs a registry and a Zod extension,
  with more boilerplate per route.
- **`@hey-api/openapi-ts` or orval as generator:** generate full SDKs or React Query hooks,
  so far more generated code to review; hey-api is pre-1.0 with frequent breaking changes.
  hey-api remains the fallback if openapi-typescript stalls.
- **tRPC or ts-rest:** end-to-end types without OpenAPI generation, but they couple clients
  to TypeScript and do not produce a standard API description.
