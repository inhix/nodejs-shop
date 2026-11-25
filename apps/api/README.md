# @shop/api

NestJS (Fastify adapter) API. Modular monolith; see the root `CLAUDE.md` for architecture rules.

## Run

```sh
pnpm --filter @shop/api dev     # compile with tsc, restart on change
pnpm --filter @shop/api test    # Vitest: unit (src/**/*.spec.ts), HTTP and integration (test/)
pnpm --filter @shop/api build && pnpm --filter @shop/api start
```

`pnpm dev` needs Postgres and Redis from `pnpm infra:up` (repo root) and the variables from `.env`.
Integration tests (`test/*.int.spec.ts`) start their own containers with Testcontainers, so they
need a running Docker daemon but not `infra:up`. Image tags are read from `docker-compose.yml`.

## Configuration

Validated with Zod at startup (`src/config/config.ts`). On invalid values the process prints the
variable names (never the values) and exits with code 1.

| Variable       | Default       | Notes                                                  |
| -------------- | ------------- | ------------------------------------------------------ |
| `NODE_ENV`     | `development` | `development` enables pretty logs                      |
| `HOST`         | `127.0.0.1`   | `0.0.0.0` in the Docker image                          |
| `PORT`         | `3000`        |                                                        |
| `LOG_LEVEL`    | `info`        | `fatal` `error` `warn` `info` `debug` `trace` `silent` |
| `DATABASE_URL` | required      | `postgres://` or `postgresql://`                       |
| `REDIS_URL`    | required      | `redis://` or `rediss://` (TLS)                        |

## HTTP conventions

- Errors are RFC 9457 Problem Details (`application/problem+json`) with a `requestId`.
- Every response carries `x-request-id`. A well-formed incoming ID is reused, otherwise a UUID.
- `GET /health/live`: liveness, no dependencies. Used by the Docker `HEALTHCHECK`.
- `GET /health/ready`: readiness, for the load balancer. `200 ok` when Postgres and Redis respond,
  `200 degraded` when only Redis is down (checkout works without it), `503` Problem Details with a
  `checks` member when Postgres is down. Each check times out after 1 second.
- Neither health endpoint is logged.

## Dependencies

- Postgres: `pg` pool, connections open lazily on the first query.
- Redis: `redis` (node-redis) client. It connects in the background and reconnects forever with
  backoff, so a Redis outage never blocks boot. While disconnected, commands fail immediately.

## Docker

Built from the repo root: `docker build -f apps/api/Dockerfile -t shop-api .`
The image runs as the non-root `node` user and has a `HEALTHCHECK` on `/health/live`.
