# @shop/contracts

Zod schemas for every API request and response, and the OpenAPI 3.1 document built from
them. See ADR 0007 (`docs/adr/0007-contracts-pipeline.md`).

- `src/`: schemas by area (`common/`, `health.ts`, …); `src/openapi.ts` lists every route.
- `openapi.json`: generated, committed. Never edit by hand.

After changing a schema or route, run `pnpm generate` from the repo root and commit
`openapi.json` and `packages/api-client/src/generated/schema.ts`. Tests fail if they are
stale, and the API's contract test fails if its routes and the document differ.
