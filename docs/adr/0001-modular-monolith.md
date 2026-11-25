# 0001. Modular monolith

- Status: Accepted
- Date: 2026-11-25

## Context

The shop has about ten business areas (catalog, cart, checkout, orders, payments, inventory,
users, shipping, fiscalization, notifications) that are tightly connected: checkout touches
cart, inventory, orders, payments and shipping in one customer action. It is built by one
developer with AI assistance, deployed on AWS, and must stay correct under concurrency
(stock, payments). Expected traffic is that of a single-country shop, not millions of
requests per second.

## Decision

One NestJS API (`apps/api`) organized as a modular monolith, plus a background worker that
runs from the same codebase and image with a different start command.

- Each business area is a Nest module and owns its tables.
- A module never reads or writes another module's tables. It uses the other module's
  exported service, or reacts to domain events.
- Side effects that cross module or system boundaries go through the transactional outbox
  and BullMQ jobs.
- The Next.js frontends contain no business logic; they call the API through the generated
  client.

## Consequences

- Checkout can reserve stock and create an order in one database transaction, without
  distributed transactions or sagas.
- One deployable API, one database, one set of logs: simple to run, debug and test.
- Boundaries are enforced by convention and review, not by the network. They can erode;
  code review and, later, lint rules on imports between modules have to hold the line.
- A module with very different scaling needs can be extracted later, because it already
  talks to the rest through a service interface and events.
- The whole API scales as one unit. At this scale that is acceptable.

## Alternatives considered

- **Microservices:** independent deployment and scaling, but they turn checkout into a
  distributed transaction, multiply infrastructure (several databases, service discovery,
  tracing), and solve team-scaling problems this project does not have.
- **Unstructured monolith (layers only: controllers, services, repositories):** fastest to
  start, but any service can touch any table, so business areas tangle and nothing can be
  extracted later.
