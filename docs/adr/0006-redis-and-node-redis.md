# 0006. Redis 7.2 OSS with the node-redis client

- Status: Accepted
- Date: 2026-11-25

## Context

The shop needs background jobs (BullMQ), sessions, rate limiting shared across instances,
and some caching. Production runs on ElastiCache. Checkout must keep working if Redis is
unavailable.

## Decision

- **Redis OSS, pinned to 7.2** (`redis:7.2.17` locally and in Testcontainers). ElastiCache
  for Redis OSS is on the 7.x line (7.1, compatible with 7.0), so 7.2 is the closest local
  match and avoids features newer than what runs in AWS. 7.2 is also the last line under the
  BSD license; 7.4 moved to RSAL/SSPL, and 8.x adds AGPL as an option.
- **node-redis** (`redis` package, Redis's official client).
- **Redis is optional at runtime:**
  - the client connects in the background and reconnects forever with backoff, so a Redis
    outage never blocks boot;
  - while disconnected, commands fail immediately instead of queueing in memory, so callers
    can fall back;
  - readiness reports `degraded` (HTTP 200) when only Redis is down, so the load balancer
    keeps the instance in service.
- Key naming `<domain>:<id>`; every key that should expire has a TTL.

## Consequences

- Sessions, rate limits and caches must each define what happens when Redis is down (for
  example: rate limiting fails open, cache misses go to Postgres).
- Queued side effects are delayed, not lost, during a Redis outage, because the outbox in
  Postgres is the source of truth.
- Staying on 7.2 means newer Redis features (for example hash field expiry from 7.4) are
  unavailable.

## Alternatives considered

- **Valkey:** the community fork of Redis 7.2, protocol-compatible and cheaper on
  ElastiCache. Redis was kept as the more recognized standard; switching later is a client
  config change, not a code change.
- **ioredis:** BullMQ's long-time default and well proven. BullMQ 6 also supports
  node-redis, which is maintained by Redis itself and actively developed.
- **Postgres-only (sessions and jobs in tables):** one less system, but weaker for rate
  limiting and job scheduling at the throughput BullMQ handles.
