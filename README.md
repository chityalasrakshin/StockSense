# StockSense — Inventory Management System

> Production-grade, stateful, ledger-backed Inventory Management System (Receipts, Delivery Orders, Internal Transfers, Adjustments, Multi-Warehouse, Stock Ledger, OTP Auth).

---

## 1. Monorepo Layout

The repository is organized as a unified `pnpm` workspaces monorepo following the layout defined in **`architecture.md` Section 7**:

```text
stocksense/
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

## 2. Mapping to `architecture.md`

| Requirement / Architecture Specification | Repository Implementation                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend Foundation (§3.3, §7)**       | `frontend/`: Referenced `Kiranism/next-shadcn-dashboard-starter` for admin shell & data-table patterns, adapted directly into StockSense's `frontend/`. Preserved sidebar/header shell, data-table + URL-state (`nuqs`), feature-sliced folders (`frontend/src/features/<domain>/{api,components,schemas}`), and TanStack Query. Removed Clerk, billing, and demo apps. Typed API client points to `NEXT_PUBLIC_API_URL`. |
| **Backend Foundation (§3.4, §7, §12)**   | `backend/`: NestJS modular architecture with Prisma ORM. Global exception filter enforcing `{ error: { code, message, fieldErrors? } }`. Zod env validation. Swagger/OpenAPI docs at `/api/docs`. Health check at `GET /api/v1/health`.                                                                                                                                                                                   |
| **Background Workers (§5, §6, §7)**      | `workers/`: BullMQ runner skeleton connecting to Redis for low-stock alerts, OTP email dispatch, and report generation.                                                                                                                                                                                                                                                                                                   |
| **Single Lint & Type Standard (§8)**     | `configs/`: One shared ESLint flat config, one Prettier config, and one base tsconfig extended across `frontend/`, `backend/`, and `workers/`.                                                                                                                                                                                                                                                                            |
| **Data Layer & Ledger Schema (§11)**     | `database/schema.sql` & `backend/prisma/schema.prisma`: Dual-model architecture with append-only `stock_ledger` and `stock_balances` read cache.                                                                                                                                                                                                                                                                          |
| **Local Infrastructure (§5, §13)**       | `docker/` & root `docker-compose.yml`: Local multi-service environment (PostgreSQL 16, Redis 7, MinIO S3 storage, NestJS backend, Next.js frontend).                                                                                                                                                                                                                                                                      |

---

## 3. Quick Start (Local Development)

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

## 4. Running with Docker Compose

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

## 5. Verification Commands

```bash
# Health check validation
curl http://localhost:4000/api/v1/health

# Monorepo typechecking
pnpm run typecheck

# Monorepo shared linting
pnpm run lint
```
