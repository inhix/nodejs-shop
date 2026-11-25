# 0008. Next.js App Router for the storefront and admin

- Status: Accepted
- Date: 2026-11-25

## Context

Customers need fast, indexable catalog and product pages in Ukrainian and English. Staff
need an internal admin app with tables and forms. All business logic lives in the NestJS
API (ADR 0001); the frontends must not duplicate pricing, stock or order rules. Both apps
are deployed as containers on ECS.

## Decision

Two Next.js apps, `apps/storefront` (customers) and `apps/admin` (staff), on the App Router.

- **Rendering:** server components by default. Pages call the API on the server through
  `@shop/api-client` (ADR 0007). Catalog pages will use static generation with revalidation
  (ISR) in Phase 5.
- **No business logic in the frontends.** They render and call the API; prices and totals
  always come from the API.
- **Config:** server-only variables (no `NEXT_PUBLIC_` prefix) such as `API_URL`, validated
  with Zod at startup in `instrumentation.ts`. On invalid config the process exits, because
  Next.js on its own only logs startup errors and keeps serving 500s. Local development
  loads the repo root `.env` in `next.config.ts` (dev server only).
- **Styling:** Tailwind CSS 4; shadcn/ui and next-intl arrive with the first real pages.
- **Deployment:** `output: 'standalone'`, one Docker image per app, same hardening as the API
  (non-root, no npm, Debian security updates, Trivy gate).
- **Lint:** `@next/eslint-plugin-next` and `eslint-plugin-react-hooks` on top of the shared
  config. `eslint-config-next` is not used because it bundles `eslint-plugin-react`,
  `eslint-plugin-import` and `eslint-plugin-jsx-a11y`, which do not support ESLint 10 yet.

## Consequences

- Two separate apps: the admin can be deployed, scaled, and access-restricted on its own,
  and customer bundles never contain admin code. Some setup is duplicated (two Dockerfiles,
  two configs); shared UI goes into `packages/ui`.
- Server components keep the API URL and future session cookies on the server; the browser
  talks only to the Next.js app.
- **Accessibility lint is missing** until `eslint-plugin-jsx-a11y` supports ESLint 10.
  Accessibility is checked by Playwright + axe end-to-end tests (Phase 7); revisit the lint
  plugin when a compatible release exists.
- Next.js has a fast release cadence and opinionated caching; upgrades need reading release
  notes, and caching behavior must be explicit per page.

## Alternatives considered

- **One Next.js app for customers and staff:** less setup, but admin code and routes would
  ship with the storefront, and access control and scaling could not be separated.
- **React SPA (Vite) for the storefront:** simpler hosting, but no server rendering, so
  worse first load and SEO for catalog pages.
- **Remix / React Router framework, Astro, Nuxt:** viable; Next.js has the largest ecosystem
  and the most familiarity among reviewers, and the brief already chose it.
- **Business logic in Next.js server actions or route handlers:** would split rules between
  two backends and break the single source of truth in the API.
