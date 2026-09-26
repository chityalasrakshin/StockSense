# StockSense — Inventory Management System

StockSense is a production-grade, stateful, ledger-backed Inventory Management System (IMS) designed to bring products, multi-warehouse locations, stock movements, and inventory operations into one unified workspace.

It is designed for inventory managers and warehouse staff who currently rely on manual registers, spreadsheets, or disconnected tracking methods.

---

## Contents

- [Problem](#problem)
- [Prototype & System Goals](#prototype--system-goals)
- [Users and Roles](#users-and-roles)
- [Core Workflows](#core-workflows)
- [Application Areas](#application-areas)
- [Stock Rules & Invariants](#stock-rules--invariants)
- [Data Model & Entities](#data-model--entities)
- [Document Statuses](#document-statuses)
- [Monorepo Layout](#monorepo-layout)
- [Mapping to `architecture.md`](#mapping-to-architecturemd)
- [Quick Start (Local Development)](#quick-start-local-development)
- [Running with Docker Compose](#running-with-docker-compose)
- [Verification Commands](#verification-commands)
- [Prototype Acceptance Criteria](#prototype-acceptance-criteria)
- [Roadmap](#roadmap)
- [Scope](#scope)
- [Reference](#reference)

---

## Problem

Businesses need a clear, accurate view of what stock they have, where it is located across warehouses, what is arriving from vendors, and what is being dispatched to customers. StockSense provides a centralized, ledger-backed system for managing these operations and maintaining an immutable audit trail.

---

## Prototype & System Goals

- Manage products, SKUs, categories, units of measure, and reorder levels.
- Track available stock by warehouse and internal location.
- Record incoming goods through receipts.
- Record outgoing goods through delivery orders.
- Move stock between warehouses, racks, and other locations.
- Correct differences between recorded stock and physical counts.
- Display key inventory metrics on a dashboard.
- Keep an immutable, auditable history of every validated stock movement.

---

## Users and Roles

### Inventory Manager

- Maintains products and reorder rules.
- Reviews stock levels and automated low-stock alerts.
- Creates and validates receipts, deliveries, transfers, and adjustments.
- Reviews the immutable stock ledger and system audit reports.

### Warehouse Staff

- Finds products and quantities by location.
- Performs receiving, picking, shelving, counting, and transfers.
- Updates the operational status of stock documents.

For the initial prototype, these roles can share operational workflows while role-specific permissions and authorization guards are enforced.

---

## Core Workflows

### 1. Sign In & Authentication

1. User signs in or registers via email/password.
2. User can request an OTP-based password reset.
3. Upon authentication, user is redirected to the inventory dashboard.

### 2. Receive Incoming Stock (Receipts)

1. Create a receipt document (`Draft`).
2. Select a supplier and add product lines with quantities and destination warehouse/location.
3. Transition to `Waiting` / `Ready` and validate (`Done`).
4. Validation atomically increments `stock_balances` and appends an `IN` record to the immutable `stock_ledger`.

### 3. Deliver Outgoing Stock (Delivery Orders)

1. Create a delivery order (`Draft`).
2. Add product lines and requested quantities.
3. System verifies stock availability at the source location (preventing validation if stock is insufficient).
4. Pick, pack, and validate (`Done`).
5. Validation atomically decrements `stock_balances` and appends an `OUT` record to `stock_ledger`.

### 4. Transfer Stock Internally (Internal Transfers)

1. Select source warehouse/location and destination warehouse/location.
2. Add products and transfer quantities.
3. Validate the transfer.
4. Validation decrements source location balance, increments destination location balance, and appends transfer ledger records.
5. Total company-wide stock remains unchanged.

### 5. Adjust Stock (Inventory Adjustments)

1. Select product and target location.
2. Enter physically counted quantity and an adjustment reason (damage, loss, found stock, count correction).
3. Validate adjustment.
4. System updates stock by the delta and records the adjustment in the immutable ledger.

---

## Application Areas

### Dashboard

- Key operational KPIs: Total products in stock, low-stock/out-of-stock count, pending receipts, pending deliveries, scheduled transfers.
- Recent stock movement stream.
- Multi-dimensional filtering by document type, status, warehouse/location, and product category.

### Products

- Unique SKU or product code, product name, category, unit of measure, reorder level.
- Multi-location stock breakdown and active/inactive status.

### Operations

- **Receipts**: Incoming stock from vendors.
- **Delivery Orders**: Outgoing stock for customer shipments.
- **Internal Transfers**: Stock relocations between warehouses or bins.
- **Inventory Adjustments**: Physical inventory count reconciliations.
- **Move History**: Filterable audit trail of all validated stock movements.

### Settings & Profile

- Warehouse and storage location hierarchy setup.
- User profile details and session management.

---

## Stock Rules & Invariants

1. **Document-Driven**: Every stock quantity change must originate from a formal document (Receipt, Delivery, Transfer, Adjustment).
2. **Lifecycle Gate**: Draft documents never change stock. Only validation (`Done`) executes stock mutations.
3. **No Direct Mutation**: Validated documents are immutable. Reversals or corrections require subsequent adjustment or return documents.
4. **Availability Guard**: Delivery and transfer validations are rejected if source location available stock is insufficient.
5. **Full Provenance**: Every ledger entry captures source document ID, timestamp, product ID, location ID, quantity, and movement type.
6. **Reorder Threshold**: Low-stock alerts trigger when available stock drops to or below the configured reorder level.

---

## Data Model & Entities

| Entity          | Purpose                                    | Key Attributes                                                                              |
| --------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `User`          | Authenticated application user             | `id`, `email`, `role`, `name`, `status`                                                     |
| `OtpCode`       | One-time password for auth/reset           | `id`, `user_id`, `code`, `expires_at`, `consumed`                                           |
| `Product`       | Catalog item tracked by StockSense         | `id`, `name`, `sku`, `category_id`, `uom_id`, `reorder_level`                               |
| `Category`      | Hierarchical product grouping              | `id`, `name`, `parent_id`                                                                   |
| `UnitOfMeasure` | Measurement standard                       | `id`, `name`, `symbol`                                                                      |
| `Location`      | Storage site or zone within a warehouse    | `id`, `warehouse_id`, `name`, `code`, `is_active`                                           |
| `Document`      | Operational workflow header                | `id`, `type`, `status`, `reference_no`, `source_location_id`, `dest_location_id`            |
| `DocumentLine`  | Line item on an operational document       | `id`, `document_id`, `product_id`, `quantity`                                               |
| `StockLedger`   | Append-only immutable movement audit trail | `id`, `document_id`, `product_id`, `location_id`, `quantity`, `movement_type`, `created_at` |
| `StockBalance`  | High-performance current stock read cache  | `id`, `product_id`, `location_id`, `quantity`, `updated_at`                                 |

---

## Document Statuses

```text
[ Draft ]  ──►  [ Waiting ]  ──►  [ Ready ]  ──►  [ Done (Validated) ]
    │                │                │
    ▼                ▼                ▼
[ Canceled ]   [ Canceled ]     [ Canceled ]
```

---

## Monorepo Layout

The repository is organized as a unified `pnpm` workspaces monorepo following the layout defined in **`architecture.md` Section 7**:

```text
StockSense/
├── frontend/                          # Next.js 16 App Router, TypeScript, shadcn/ui, TanStack Table/Query, nuqs
│   ├── src/
│   │   ├── app/                       # (auth) & (dashboard) routes (products, receipts, deliveries, transfers, adjustments, move-history)
│   │   ├── features/                  # Feature-sliced domain modules (auth, products, documents, dashboard)
│   │   ├── components/                # shadcn/ui primitives & layout shell (sidebar, header, user-nav)
│   │   └── lib/                       # typed API client with standard error envelope
│   └── tsconfig.json                  # extends configs/tsconfig.base.json
│
├── backend/                           # NestJS modular monolith with Prisma ORM targeting PostgreSQL
│   ├── src/
│   │   ├── modules/                   # health check, ready for domain modules (products, warehouses, documents, ledger)
│   │   ├── common/                    # global exception filter ({ error: { code, message, fieldErrors? } }), prisma service
│   │   ├── config/                    # global config module with Zod env validation
│   │   └── main.ts                    # bootstrap with global prefix /api/v1, Swagger at /api/docs
│   └── prisma/schema.prisma           # Full schema matching architecture.md section 11
│
├── workers/                           # BullMQ background worker runner connecting to Redis
│   └── src/                           # worker skeletons (low-stock-alert, email-otp, report-export)
│
├── infrastructure/                    # Terraform definitions (VPC, RDS PostgreSQL 16, ElastiCache Redis, S3)
├── docker/                            # Docker compose & service Dockerfiles for dev environment
├── database/                          # PostgreSQL DDL schema matching architecture.md section 11 & seed scripts
├── .github/workflows/                 # CI pipeline (lint, typecheck, build) & deployment workflows
├── tests/e2e/                         # Playwright end-to-end smoke test suite
├── docs/                              # ADRs (docs/adr/0001-initial-scaffold.md) & architectural documentation
├── scripts/                           # Local environment bootstrap & database seeding scripts
└── configs/                           # Shared ESLint flat config, Prettier config, and base tsconfig
```

---

## Mapping to `architecture.md`

| Requirement / Architecture Specification | Repository Implementation                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend Foundation (§3.3, §7)**       | `frontend/`: Referenced `Kiranism/next-shadcn-dashboard-starter` for admin shell & data-table patterns, adapted directly into StockSense's `frontend/`. Preserved sidebar/header shell, data-table + URL-state (`nuqs`), feature-sliced folders (`frontend/src/features/<domain>/{api,components,schemas}`), and TanStack Query. Removed Clerk, billing, and demo apps. Typed API client points to `NEXT_PUBLIC_API_URL`. |
| **Backend Foundation (§3.4, §7, §12)**   | `backend/`: NestJS modular architecture with Prisma ORM. Global exception filter enforcing `{ error: { code, message, fieldErrors? } }`. Zod env validation. Swagger/OpenAPI docs at `/api/docs`. Health check at `GET /api/v1/health`.                                                                                                                                                                                   |
| **Background Workers (§5, §6, §7)**      | `workers/`: BullMQ runner skeleton connecting to Redis for low-stock alerts, OTP email dispatch, and report generation.                                                                                                                                                                                                                                                                                                   |
| **Single Lint & Type Standard (§8)**     | `configs/`: One shared ESLint flat config, one Prettier config, and one base tsconfig extended across `frontend/`, `backend/`, and `workers/`.                                                                                                                                                                                                                                                                            |
| **Data Layer & Ledger Schema (§11)**     | `database/schema.sql` & `backend/prisma/schema.prisma`: Dual-model architecture with append-only `stock_ledger` and `stock_balances` read cache.                                                                                                                                                                                                                                                                          |
| **Local Infrastructure (§5, §13)**       | `docker/` & root `docker-compose.yml`: Local multi-service environment (PostgreSQL 16, Redis 7, MinIO S3 storage, NestJS backend, Next.js frontend).                                                                                                                                                                                                                                                                      |

---

## Quick Start (Local Development)

### Prerequisites

- Node.js LTS (v22+)
- `pnpm` (v10+ or v12+)
- Docker & Docker Compose (optional for containerized workflow)

### Local Setup with pnpm

1. **Install all dependencies across the monorepo**:

   ```bash
   pnpm install
   ```

2. **Generate the Prisma client**:

   ```bash
   pnpm --filter stocksense-backend prisma:generate
   ```

3. **Verify linting and typechecking**:

   ```bash
   pnpm run lint
   pnpm run typecheck
   ```

4. **Start the development servers**:

   ```bash
   # Terminal 1: Backend API (runs on port 4000)
   pnpm dev:backend

   # Terminal 2: Frontend Dashboard (runs on port 3000)
   pnpm dev:frontend

   # Terminal 3 (optional): Worker runner
   pnpm dev:workers
   ```

5. **Access the services**:
   - **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
   - **Backend Health Check**: [http://localhost:4000/api/v1/health](http://localhost:4000/api/v1/health)
   - **Swagger / OpenAPI Documentation**: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)

---

## Running with Docker Compose

To boot the complete containerized stack:

```bash
docker compose up
```

This launches:

- **`postgres`** (PostgreSQL 16) at `localhost:5432` (named volume: `stocksense_postgres_data`)
- **`redis`** (Redis 7) at `localhost:6379` (named volume: `stocksense_redis_data`)
- **`minio`** (S3-compatible Object Storage) at `localhost:9000` / Console: `localhost:9001` (named volume: `stocksense_minio_data`)
- **`backend`** (NestJS dev mode with hot reload) at `localhost:4000`
- **`frontend`** (Next.js dev mode with hot reload) at `localhost:3000`

---

## Verification Commands

```bash
# Health check validation
curl http://localhost:4000/api/v1/health

# Monorepo typechecking
pnpm run typecheck

# Monorepo shared linting
pnpm run lint
```

### Screen Recording Walkthrough (Jury Demo)

To drive the automated 2.5–3 minute screen-recording walkthrough of StockSense in headed mode at 1920x1080 viewport (ready for direct OBS video capture):

```bash
npx playwright test tests/demo/jury-demo.spec.ts --headed
```

---

## Prototype Acceptance Criteria

1. Log in and reach the dashboard.
2. Create a product and see it in the product list.
3. Create and validate a receipt, then see stock increase.
4. Create and validate a delivery, then see stock decrease.
5. Transfer stock between two locations and see both balances update.
6. Make an adjustment and see the difference reflected in stock.
7. View the resulting operations in move history.
8. Find low-stock and out-of-stock items from the dashboard.

---

## Roadmap

### Phase 1 - Prototype Foundation

- Authentication screens & OTP reset.
- Dashboard shell and navigation.
- Product and category management.
- Multi-warehouse setup with storage locations.

### Phase 2 - Inventory Operations

- Receipts and deliveries workflow engine.
- Internal transfers across warehouses and locations.
- Stock adjustments with physical count reconciliation.
- Stock ledger and dashboard low-stock alerts.

### Phase 3 - Usability & Reporting

- Full-text search, sorting, and faceted URL-synced filters.
- Multi-warehouse aggregation views.
- Fine-grained role-based permissions (Inventory Manager vs Warehouse Staff).
- CSV / Excel report generation workers.

### Later Phases

- Supplier and customer integrations.
- Barcode / QR code scanning workflows.
- Real-time notification center.
- Production multi-region cloud deployment.

---

## Scope

The primary focus is establishing the core event-sourced inventory lifecycle (Receipts, Deliveries, Transfers, Adjustments, Ledger) with high usability and data integrity.

---

## Reference

- Architecture Specification: [`architecture.md`](./architecture.md)
- Initial Prototype Design & Wireframes: [Excalidraw Mockup](https://link.excalidraw.com/l/65VNwvy7c4X/3ENvQFu9o8R)
