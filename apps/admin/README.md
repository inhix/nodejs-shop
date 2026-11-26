# @shop/admin

Staff-facing Next.js app (App Router). It only renders UI and calls the API through
`@shop/api-client`; no business logic lives here. See ADR 0008.

> **No authentication yet.** Sessions and role-based access arrive in Phase 2, and network
> restriction in AWS with the infrastructure work. Until then, never deploy this app anywhere
> reachable from the internet.

## Run

```sh
pnpm dev                          # repo root: API, storefront and admin (3002 by default)
pnpm --filter @shop/admin dev     # admin only, on http://127.0.0.1:3002
pnpm --filter @shop/admin test
```

The dev server loads the repo root `.env`. Production builds and the Docker image never read
a `.env` file.

## Configuration

Validated with Zod when the server starts (`src/instrumentation.ts`). On invalid values the
process prints the variable names (never the values) and exits with code 1.

| Variable  | Required | Notes                                                |
| --------- | -------- | ---------------------------------------------------- |
| `API_URL` | yes      | `http(s)://` URL of the API, used on the server only |

## Search engines

Every response carries `X-Robots-Tag: noindex, nofollow`, and pages also have a `robots`
noindex meta tag.

## Endpoints

- `/`: placeholder home page showing whether the API is reachable (rendered per request).
- `GET /health/live`: liveness for the Docker `HEALTHCHECK`, no dependencies.

## Docker

Built from the repo root: `docker build -f apps/admin/Dockerfile -t shop-admin .`
Next.js standalone output, non-root `node` user, listens on port 3000 in the container.
