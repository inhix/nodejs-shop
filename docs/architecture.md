# Architecture: domain model

How the shop's data is divided between API modules, how the tables relate, and how modules
talk to each other. The system overview is in `PROJECT_BRIEF.md` (section 3); the order
lifecycle is in [ADR 0011](adr/0011-order-state-machine.md).

This file is the design. Once a module's tables exist, its Drizzle schema in `apps/api` is
the source of truth, and any PR that changes the schema updates this file in the same PR.

## Scope

The ERD covers the whole domain, but each module's tables are created in the phase that
first uses them, because untested tables tend to be designed wrong:

| Phase | Tables |
|---|---|
| 1 | catalog, orders, inventory |
| 2 | users, audit_log |
| 3 | carts, payments, outbox_events |
| 4 | discounts, refunds, shipping, fiscalization |

Columns that depend on a provider's API (monobank, LiqPay, Checkbox, Nova Poshta) are
generic here (`provider_ref`, `dedup_key`) and are defined when the provider's docs are
added to `docs/vendor/`.

## Table ownership

A module never reads or writes another module's tables (ADR 0001). It calls that module's
exported service, which may take the caller's transaction, or reacts to its events.

| Module | Tables |
|---|---|
| users | `users`, `addresses` |
| catalog | `categories`, `products`, `product_variants`, `product_images` |
| inventory | `stock_levels`, `inventory_reservations` |
| cart | `carts`, `cart_items` |
| checkout | `discount_codes`, `discount_redemptions` |
| orders | `orders`, `order_items`, `order_status_history` |
| payments | `payments`, `payment_events`, `refunds` |
| shipping | `shipments`, `nova_poshta_cities`, `nova_poshta_branches` |
| fiscalization | `fiscal_receipts` |
| notifications | none yet |
| platform (shared infrastructure) | `outbox_events`, `audit_log` |

- **Sessions** live in Redis (`session:{id}`), not Postgres; the Phase 2 auth ADR settles
  the details.
- **Stock** belongs to inventory, not to `product_variants`, so checkout can lock and change
  it without writing catalog tables.
- **Checkout** orchestrates cart, inventory, orders and payments; the only tables it owns
  are for discount codes.
- **Platform tables** are written through `OutboxService` and `AuditService`, inside the
  calling module's transaction.

## Conventions

- `id uuid PRIMARY KEY DEFAULT uuidv7()` (Postgres 18). Code may pass its own UUIDv7.
- Every table has `created_at` and `updated_at` (`timestamptz NOT NULL`); `updated_at` is set
  by Drizzle's `$onUpdate`. They are left out of the diagrams below.
- Money: `<name>_amount integer` in minor units with `CHECK (<name>_amount >= 0)`, and
  `currency char(3) NOT NULL DEFAULT 'UAH'`. An order has one currency; its rows use it.
- Statuses and kinds: `text` with a `CHECK` listing the allowed values, not Postgres enums.
- Soft delete: `deleted_at timestamptz` on catalog tables. Rows other tables refer to are
  never hard-deleted.
- Translatable text: `jsonb` `{ "uk": "...", "en": "..." }`, `uk` required, validated with Zod.
- Phones in E.164 (`+380...`). Emails stored lower-cased.

## Overview

```mermaid
erDiagram
    users ||--o{ addresses : has
    users ||--o{ orders : places
    users |o--o| carts : owns
    categories ||--o{ categories : parent_of
    categories ||--o{ products : contains
    products ||--|{ product_variants : has
    products ||--o{ product_images : has
    product_variants ||--|| stock_levels : stocked_as
    product_variants ||--o{ inventory_reservations : reserved_by
    product_variants ||--o{ cart_items : in
    product_variants ||--o{ order_items : sold_as
    carts ||--o{ cart_items : contains
    orders ||--|{ order_items : contains
    orders ||--|{ order_status_history : records
    orders ||--|{ inventory_reservations : holds
    orders ||--o{ payments : paid_by
    orders ||--o{ refunds : refunded_by
    orders ||--o{ shipments : shipped_as
    orders ||--o{ fiscal_receipts : receipted_by
    orders |o--o| discount_redemptions : uses
    discount_codes ||--o{ discount_redemptions : redeemed_as
    payments ||--o{ payment_events : updated_by
    payments ||--o{ refunds : returned_by
    nova_poshta_cities ||--o{ nova_poshta_branches : has
    nova_poshta_branches ||--o{ orders : delivers_to
    nova_poshta_branches ||--o{ addresses : saved_as
```

`outbox_events` and `audit_log` refer to rows of any module by type and ID, without foreign
keys, so they are not drawn.

## Users and catalog

```mermaid
erDiagram
    users ||--o{ addresses : has
    categories ||--o{ categories : parent_of
    categories ||--o{ products : contains
    products ||--|{ product_variants : has
    products ||--o{ product_images : has
    users {
        uuid id PK
        text email UK "lower-cased"
        text phone "E.164, nullable"
        text password_hash "Argon2"
        text role "customer | staff | admin"
        text locale "uk | en"
    }
    addresses {
        uuid id PK
        uuid user_id FK
        uuid branch_id FK "nova_poshta_branches"
        text recipient_name
        text recipient_phone "E.164"
        bool is_default "one per user"
    }
    categories {
        uuid id PK
        uuid parent_id FK "nullable"
        text slug UK
        jsonb name "uk, en"
        int sort_order
        timestamptz deleted_at
    }
    products {
        uuid id PK
        uuid category_id FK
        text slug UK
        jsonb name "uk, en"
        jsonb description "uk, en"
        text status "draft | active | archived"
        timestamptz deleted_at
    }
    product_variants {
        uuid id PK
        uuid product_id FK
        text sku UK
        int price_amount ">= 0"
        char currency
        jsonb attributes "Zod-validated per category"
        timestamptz deleted_at
    }
    product_images {
        uuid id PK
        uuid product_id FK
        uuid variant_id FK "nullable"
        text s3_key UK
        jsonb alt "uk, en"
        int sort_order
    }
```

## Inventory, cart and checkout

```mermaid
erDiagram
    product_variants ||--|| stock_levels : stocked_as
    product_variants ||--o{ inventory_reservations : reserved_by
    orders ||--|{ inventory_reservations : holds
    carts ||--o{ cart_items : contains
    product_variants ||--o{ cart_items : in
    discount_codes ||--o{ discount_redemptions : redeemed_as
    orders |o--o| discount_redemptions : uses
    stock_levels {
        uuid variant_id PK, FK
        int on_hand ">= 0"
        int reserved "0 <= reserved <= on_hand"
    }
    inventory_reservations {
        uuid id PK
        uuid order_id FK
        uuid variant_id FK
        int quantity "> 0"
        text status "active | consumed | released"
    }
    carts {
        uuid id PK
        uuid user_id FK "nullable, unique when set"
        text guest_token_hash UK "nullable"
        timestamptz expires_at
    }
    cart_items {
        uuid id PK
        uuid cart_id FK
        uuid variant_id FK
        int quantity "> 0"
    }
    discount_codes {
        uuid id PK
        text code UK "upper-cased"
        text kind "percent | fixed"
        int value "percent 1-100 or minor units"
        int min_order_amount
        timestamptz starts_at
        timestamptz ends_at
        int max_redemptions "nullable"
        int max_per_customer "nullable"
    }
    discount_redemptions {
        uuid id PK
        uuid discount_code_id FK
        uuid order_id FK, UK
        text customer_phone "E.164, for per-customer limits"
    }
```

## Orders and payments

```mermaid
erDiagram
    orders ||--|{ order_items : contains
    orders ||--|{ order_status_history : records
    orders ||--o{ payments : paid_by
    payments ||--o{ payment_events : updated_by
    orders ||--o{ refunds : refunded_by
    payments ||--o{ refunds : returned_by
    orders {
        uuid id PK
        bigint number UK "from a sequence, shown to customers"
        uuid user_id FK "nullable for guests"
        text status "ADR 0011 states"
        text payment_method "card | cod"
        text customer_email
        text customer_phone "E.164"
        text customer_name
        uuid branch_id FK "nova_poshta_branches"
        jsonb delivery_snapshot "city and branch as at purchase"
        char currency
        int subtotal_amount
        int discount_amount
        int shipping_amount
        int total_amount "= subtotal - discount + shipping"
        timestamptz payment_due_at "card, pending_payment only"
        text locale "uk | en"
    }
    order_items {
        uuid id PK
        uuid order_id FK
        uuid variant_id FK
        jsonb product_name "snapshot, uk and en"
        text sku "snapshot"
        int unit_price_amount "snapshot"
        int quantity "> 0"
        int line_total_amount "= unit price x quantity"
    }
    order_status_history {
        uuid id PK
        uuid order_id FK
        text from_status "nullable for the first row"
        text to_status
        text event
        text actor_type "customer | staff | system"
        uuid actor_id "nullable"
    }
    payments {
        uuid id PK
        uuid order_id FK
        text provider "monobank | liqpay"
        text provider_ref "UK with provider"
        text status "created | processing | succeeded | failed | expired"
        int amount
        char currency
        timestamptz provider_modified_at "stale-update check"
        text failure_reason
    }
    payment_events {
        uuid id PK
        text provider
        text dedup_key "UK with provider"
        uuid payment_id FK "nullable until matched"
        text outcome "applied | stale | ignored"
        jsonb payload "card data removed"
    }
    refunds {
        uuid id PK
        uuid order_id FK
        uuid payment_id FK "nullable for COD"
        text status "requested | processing | succeeded | failed"
        int amount
        char currency
        text provider_ref
        uuid requested_by FK "users"
    }
```

## Shipping, fiscalization and platform

```mermaid
erDiagram
    nova_poshta_cities ||--o{ nova_poshta_branches : has
    orders ||--o{ shipments : shipped_as
    orders ||--o{ fiscal_receipts : receipted_by
    payments |o--o| fiscal_receipts : sale_receipt
    refunds |o--o| fiscal_receipts : return_receipt
    shipments {
        uuid id PK
        uuid order_id FK
        text carrier "nova_poshta"
        text waybill_number UK "nullable until created"
        text status "pending | created | in_transit | delivered | returning | returned"
        int cod_amount "nullable, COD only"
        timestamptz last_tracked_at
    }
    nova_poshta_cities {
        uuid id PK
        text provider_ref UK
        jsonb name "uk, en"
        bool is_active
    }
    nova_poshta_branches {
        uuid id PK
        uuid city_id FK
        text provider_ref UK
        text kind "branch | locker"
        jsonb address "uk, en"
        bool is_active
    }
    fiscal_receipts {
        uuid id PK
        uuid order_id FK
        text kind "sale | return"
        uuid payment_id FK, UK "sale receipts"
        uuid refund_id FK, UK "return receipts"
        text status "pending | issued | failed"
        int amount
        text provider_ref
    }
    outbox_events {
        uuid id PK
        text event_type "e.g. order.paid"
        text aggregate_type
        uuid aggregate_id
        jsonb payload
        timestamptz published_at "nullable"
        int attempts
    }
    audit_log {
        uuid id PK
        uuid actor_id FK "users, nullable for system"
        text action
        text entity_type
        uuid entity_id
        jsonb changes "no secrets or full PII"
        text request_id
    }
```

## Key constraints

Rules that must always hold are enforced by the database, not only in code (ADR 0004).

- **Foreign keys, including between modules,** with `ON DELETE RESTRICT`, and an index on
  every foreign key. One database makes them cheap; extracting a module later means dropping
  the ones that cross its boundary.
- **Stock:** `CHECK (on_hand >= 0)`, `CHECK (reserved >= 0 AND reserved <= on_hand)`.
  Reservations change `reserved` inside the same transaction, with the `stock_levels` row
  locked `FOR UPDATE`.
- **Quantities:** `CHECK (quantity > 0)` on reservations, cart items and order items.
  `UNIQUE (order_id, variant_id)` on reservations and `UNIQUE (cart_id, variant_id)` on cart
  items.
- **Order totals:** `CHECK (total_amount = subtotal_amount - discount_amount +
  shipping_amount)` and `CHECK (line_total_amount = unit_price_amount * quantity)`.
  `payment_due_at` is set only for card orders.
- **Statuses:** a `CHECK` on every status column; for `orders.status` a test asserts it
  matches the state machine in code.
- **Payments:** `UNIQUE (provider, provider_ref)`; a partial unique index allows at most one
  `succeeded` payment per order.
- **Webhooks:** `UNIQUE (provider, dedup_key)` on `payment_events`, so a duplicate webhook
  fails the insert and is skipped.
- **Refunds:** full refunds only in v1, so a partial unique index allows one refund per order
  that is not `failed`.
- **Fiscal receipts:** a `CHECK` that a sale receipt has `payment_id` and no `refund_id`, and
  a return receipt the opposite; the unique keys give one receipt per payment and per refund.
- **Carts:** one cart per user (`UNIQUE (user_id)`), and a guest cart is found by the hash of
  its cookie token, never the token itself.
- **Catalog:** `sku` and slugs are unique among all rows, deleted ones included, so an old
  order's SKU never points to a different product.
- **Nova Poshta directory:** the nightly sync marks branches and cities inactive instead of
  deleting them, so saved addresses and old orders keep their references.

## How modules communicate

### Placing an order

Checkout runs the steps that must succeed or fail together in one transaction, through
other modules' exported services:

```mermaid
sequenceDiagram
    participant C as Checkout
    participant Cart
    participant Cat as Catalog
    participant Inv as Inventory
    participant Ord as Orders
    participant Out as Outbox
    C->>Cart: read items
    C->>Cat: current prices and snapshots
    Note over C: compute totals server-side
    C->>C: BEGIN
    C->>Ord: create order (pending_payment or confirmed)
    C->>Inv: reserve stock (rows locked FOR UPDATE)
    C->>Out: write order.placed
    C->>C: COMMIT
    C->>Cart: clear cart
```

For a card order, checkout then asks payments to create an invoice directly, because the
customer is waiting for the payment link. Payment status changes only from verified webhooks
or the reconciliation job.

### Payment confirmation

The webhook handler verifies the signature, records the payment status and applies
`payment_succeeded` through the orders service, all in one transaction, then writes outbox
events and responds. It calls no external service. Doing the order transition in the same
transaction, not through an event, keeps the window for a late payment as small as possible.

### Reservation expiry

The expiry job in the orders module finds card orders in `pending_payment` whose
`payment_due_at` has passed. For each it applies `reservation_expired` with compare-and-set
(ADR 0011) and, in the same transaction, calls inventory to release the reservations. A
payment webhook and the job therefore cannot both win: whichever changes the status first
decides, and the loser sees zero updated rows.

### Domain events

Each state change writes an outbox event in the same transaction. A publisher moves them to
BullMQ; consumers are idempotent.

| Event | Producer | Consumers |
|---|---|---|
| `order.placed` | orders | notifications (confirmation email) |
| `order.paid` | orders | fiscalization (sale receipt), notifications |
| `order.cancelled` | orders | notifications |
| `order.shipped`, `order.delivered`, `order.returned` | orders | notifications; inventory (stock back on `returned`) |
| `order.completed` | orders | none yet (reports and review requests later) |
| `order.refund_pending` | orders | payments (creates the refund); inventory (releases the reservation, or returns stock if the goods came back) |
| `order.refunded` | orders | notifications |
| `payment.succeeded`, `payment.failed` | payments | notifications |
| `refund.succeeded` | payments | orders (applies `refund_completed`), fiscalization (return receipt) |
| `shipment.accepted`, `shipment.delivered`, `shipment.returned` | shipping | orders (applies the parcel events), inventory (consumes reservations on accepted) |

The exact list grows with the phases that build each consumer.
