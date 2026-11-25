# 0004. PostgreSQL as the database

- Status: Accepted
- Date: 2026-11-25

## Context

The shop stores money, stock and orders, where correctness under concurrency matters.
Products have category-specific attributes. Customers need typo-tolerant search in
Ukrainian. Schema changes go through migrations in CI. Production runs on AWS.

## Decision

PostgreSQL 18, on RDS in production.

- Rules that must always hold are database constraints too (`NOT NULL`, `CHECK`, foreign
  keys, unique), not only code. For example, stock can never go below zero.
- Category-specific product attributes use JSONB, validated with Zod when read and written.
- Search starts with Postgres full-text search plus `pg_trgm` for typos.
- Local (Docker Compose), test (Testcontainers) and AWS run the same major version. Locally
  the image is `postgres:18.7-trixie`: Debian with glibc, not Alpine with musl, so text
  collation and sorting match RDS.

## Consequences

- Transactional DDL: a failed migration rolls back completely.
- Row locking (`SELECT ... FOR UPDATE`) makes stock reservation safe under concurrent
  checkouts.
- No separate search service to run at first.
- Postgres 18 is the newest major generally available on RDS. Some RDS extensions and
  dictionaries differ from a local Postgres; for example a custom Ukrainian full-text
  dictionary may not be installable on RDS, so search must be designed with what RDS
  supports.
- Upgrading the major version means changing Compose, Testcontainers and Terraform together.

## Alternatives considered

- **MySQL:** viable and widely hosted, but DDL is not transactional, and JSON and full-text
  search are weaker.
- **Aurora PostgreSQL:** faster failover and storage scaling, but higher minimum cost at
  this scale. The migration path from RDS exists if needed.
- **MongoDB or another document store:** flexible attributes, but weaker multi-document
  transactions and constraints for orders, stock and payments.
