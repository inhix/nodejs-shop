# syntax=docker/dockerfile:1
# Build from the repo root: docker build -f apps/storefront/Dockerfile .

ARG NODE_IMAGE=node:26.13.1-trixie-slim

# 1. Keep only the files @shop/storefront needs (better layer caching, smaller context).
FROM ${NODE_IMAGE} AS pruner
WORKDIR /repo
COPY . .
# turbo version comes from the root package.json, so there is one source of truth.
RUN npx --yes "turbo@$(node -p "require('./package.json').devDependencies.turbo")" \
      prune @shop/storefront --docker

# 2. Install dependencies from the lockfile and build. Next's standalone output contains the
#    server and only the node_modules files it actually uses.
FROM ${NODE_IMAGE} AS builder
ENV HUSKY=0 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo
COPY --from=pruner /repo/out/json/ ./
# pnpm version comes from "packageManager" in the root package.json.
RUN npm install --global "$(node -p "require('./package.json').packageManager")"
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile --store-dir /pnpm-store
COPY --from=pruner /repo/out/full/ ./
RUN pnpm turbo run build --filter=@shop/storefront

# 3. Runtime: the standalone server and static assets only, running as non-root.
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
# Install Debian security fixes released since the Node base image was last rebuilt.
RUN apt-get update \
 && apt-get upgrade --yes --no-install-recommends \
 && rm -rf /var/lib/apt/lists/*
# The app never runs npm or npx; removing them shrinks the attack surface.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
# Files stay owned by root, so the app user cannot modify its own code.
COPY --from=builder /repo/apps/storefront/.next/standalone ./
COPY --from=builder /repo/apps/storefront/.next/static ./apps/storefront/.next/static
COPY --from=builder /repo/apps/storefront/public ./apps/storefront/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/health/live').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "apps/storefront/server.js"]
