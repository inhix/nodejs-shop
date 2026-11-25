# @shop/storefront

Customer-facing Next.js app (App Router). It only renders UI and calls the API through
`@shop/api-client`; no business logic lives here. See ADR 0008.

## Run

```sh
pnpm infra:up                          # repo root; the API needs Postgres and Redis
pnpm --filter @shop/api dev            # API on http://127.0.0.1:3000
pnpm --filter @shop/storefront dev     # storefront on http://127.0.0.1:3001
pnpm --filter @shop/storefront test
```

The dev server loads the repo root `.env`. Production builds and the Docker image never read
a `.env` file.

## Configuration

Validated with Zod when the server starts (`src/instrumentation.ts`). On invalid values the
process prints the variable names (never the values) and exits with code 1.

| Variable          | Required | Notes                                                                            |
| ----------------- | -------- | -------------------------------------------------------------------------------- |
| `API_URL`         | yes      | `http(s)://` URL of the API, used on the server only                             |
| `STOREFRONT_PORT` | no       | Dev server port, default `3001`. Root `pnpm dev` sets it (and `API_URL`) per run |

## Endpoints

- `/`: placeholder home page showing whether the API is reachable (rendered per request).
- `GET /health/live`: liveness for the Docker `HEALTHCHECK`, no dependencies.

## Docker

Built from the repo root: `docker build -f apps/storefront/Dockerfile -t shop-storefront .`
Next.js standalone output, non-root `node` user, listens on port 3000 in the container.
