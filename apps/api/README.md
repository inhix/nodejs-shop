# @shop/api

NestJS (Fastify adapter) API. Modular monolith; see the root `CLAUDE.md` for architecture rules.

## Run

```sh
pnpm --filter @shop/api dev     # compile with tsc, restart on change
pnpm --filter @shop/api test    # Vitest: unit (src/**/*.spec.ts) and HTTP (test/)
pnpm --filter @shop/api build && pnpm --filter @shop/api start
```

## Configuration

Validated with Zod at startup (`src/config/config.ts`). On invalid values the process prints the
variable names (never the values) and exits with code 1.

| Variable    | Default       | Notes                                                  |
| ----------- | ------------- | ------------------------------------------------------ |
| `NODE_ENV`  | `development` | `development` enables pretty logs                      |
| `HOST`      | `127.0.0.1`   | `0.0.0.0` in the Docker image                          |
| `PORT`      | `3000`        |                                                        |
| `LOG_LEVEL` | `info`        | `fatal` `error` `warn` `info` `debug` `trace` `silent` |

## HTTP conventions

- Errors are RFC 9457 Problem Details (`application/problem+json`) with a `requestId`.
- Every response carries `x-request-id`. A well-formed incoming ID is reused, otherwise a UUID.
- `GET /health/live`: liveness, no dependencies, not logged.

## Docker

Built from the repo root: `docker build -f apps/api/Dockerfile -t shop-api .`
The image runs as the non-root `node` user and has a `HEALTHCHECK` on `/health/live`.
